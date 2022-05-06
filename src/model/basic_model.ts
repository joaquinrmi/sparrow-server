import { Pool } from "pg";
import { If, IsFunction } from "../conditional";
import BasicDocument, { DocumentAttributes } from "./basic_document";
import SearchQuery from "./search_query";
import Schema from "./schema/schema";
import SearchOrder from "./search_order";
import { QuerySelectorList, QuerySymbol } from "./query_selector";
import InnerJoinQuery from "./inner_join_query";

class BasicModel<DocumentType extends BasicDocument>
{
    private schema: Schema<DocumentType>;
    private columnList: Array<keyof DocumentAttributes<DocumentType>>;
    private pool: Pool;

    constructor(schema: Schema<DocumentType>, pool: Pool)
    {
        this.schema = schema;
        this.pool = pool;

        for(let column in this.schema.getDocumentDefinition())
        {
            this.columnList.push(column);
        }
    }

    async initialize(): Promise<void>
    {
        try
        {
            await this.pool.query(this.schema.getCreationInstructions(), this.schema.getCreationParameters());
        }
        catch(err)
        {
            throw err;
        }
    }

    getTableName(): string
    {
        return this.schema.getTableName();
    }

    async exists(conditions: SearchQuery<DocumentType>): Promise<boolean>
    {
        return false;
    }

    async find(conditions: SearchQuery<DocumentType>, columns?: Array<keyof DocumentAttributes<DocumentType>>): Promise<Array<DocumentType>>
    {
        let selectedColumns: string;
        if(columns)
        {
            selectedColumns = columns.join(", ");
        }
        else
        {
            selectedColumns = this.columnList.join(", ");
        }

        let values = [];
        let conditionsStr = this.parseWhere(conditions, values);
        let extraConditionsStr = this.parseExtraConditions(conditions);

        let query = `SELECT ${selectedColumns} FROM ${this.schema.getTableName()} ${conditionsStr} ${extraConditionsStr};`;

        try
        {
            var response = await this.pool.query(query, values);
        }
        catch(err)
        {
            throw err;
        }

        let result = new Array<DocumentType>();

        for(let i = 0; i < response.rowCount; ++i)
        {
            result.push(this.createDocument(response.rows[i]));
        }

        return result;
    }

    async innerJoin<FromDocumentType extends BasicDocument>(
        conditions: InnerJoinQuery<DocumentType, FromDocumentType>,
        columns: {
            first?: Array<keyof DocumentAttributes<DocumentType>>,
            second?: Array<keyof DocumentAttributes<FromDocumentType>>
        },
        secondModel: BasicModel<FromDocumentType>
    ): Promise<Array<InnerJoin<DocumentType, FromDocumentType>>>
    {
        let columnArray: Array<string>;
        if(columns.first)
        {
            (columnArray as Array<keyof DocumentAttributes<DocumentType>>) = columns.first;
        }
        else
        {
            (columnArray as Array<keyof DocumentAttributes<DocumentType>>) = this.columnList;
        }

        for(let i = 0; i < columnArray.length; ++i)
        {
            columnArray[i] = `${this.schema.getTableName()}.${columnArray[i]}`
        }

        const selectedColumns = columnArray.join(", ");

        let values = [];
        let conditionsStr = this.parseInnerJoinConditions(conditions, values, secondModel.getTableName());
        let extraConditionsStr = this.parseInnerJoinExtraConditions(conditions, secondModel.getTableName());

        let query = `SELECT ${selectedColumns} FROM ${secondModel.getTableName()} INNER JOIN ${this.schema.getTableName()} ON ${conditionsStr} ${extraConditionsStr};`;

        try
        {
            var response = await this.pool.query(query, values);
        }
        catch(err)
        {
            throw err;
        }

        let result = new Array<InnerJoin<DocumentType, FromDocumentType>>();

        for(let i = 0; i < response.rowCount; ++i)
        {
            result.push({
                firstDocuments: this.createDocument(response.rows[i])
            });
        }

        return result;
    }

    private createDocument(data: any): DocumentType
    {
        let document: BasicDocument = {};

        for(let column of this.columnList)
        {
            if(data[column])
            {
                document[column as string] = data[column];
            }
        }

        for(let method in this.schema.methods)
        {
            (document as DocumentType)[method] = this.schema.methods[method];
        }

        return document as DocumentType;
    }

    private parseWhere<SearchDocumentType extends BasicDocument>(conditions: SearchQuery<SearchDocumentType>, values: Array<any>): string
    {
        let where = this.parseConditions(conditions, values);

        if(where.length > 0)
        {
            return `WHERE ${where.join(" AND ")}`;
        }

        return "";
    }

    private parseConditions<SearchDocumentType extends BasicDocument>(conditions: SearchQuery<SearchDocumentType>, values: Array<any>): Array<string>
    {
        let valueId = values.length + 1;

        let whereProps = new Array<string>();
        if(conditions.props)
        {
            for(let prop in conditions.props)
            {
                if(typeof conditions.props[prop] === "object" && !Array.isArray(conditions.props[prop]))
                {
                    let selectors = conditions.props[prop];

                    for(let selector in selectors)
                    {
                        whereProps.push(`${prop}${QuerySymbol[selector as QuerySelectorList]}${`$${valueId++}`}`);
                        values.push(selectors[selector]);
                    }
                }
                else
                {
                    whereProps.push(`${prop}=${`$${valueId++}`}`);
                    values.push(conditions.props[prop]);
                }
            }
        }

        return whereProps;
    }

    private parseExtraConditions<SearchDocumentType extends BasicDocument>(conditions: SearchQuery<SearchDocumentType>): string
    {
        const extraConditions = this.extractExtraConditions(conditions);

        let orderBy = "";
        if(extraConditions.orderBy.length > 0)
        {
            orderBy = `ORDER BY ${extraConditions.orderBy.join(", ")}`;
        }

        return `${orderBy} ${extraConditions.offset} ${extraConditions.limit}`;
    }

    private parseInnerJoinExtraConditions<SecondDocumentType>(conditions: InnerJoinQuery<DocumentType, SecondDocumentType>, secondTableName: string): string
    {
        const firstExtraConditions = this.extractExtraConditions(conditions.firstConditions);
        const secondExtraConditions = this.extractExtraConditions(conditions.secondConditions);

        let orderBy = "";
        if(firstExtraConditions.orderBy.length > 0 || secondExtraConditions.orderBy.length > 0)
        {
            let allOrderBy = [
                ...firstExtraConditions.orderBy.map(col => `${this.schema.getTableName()}.${col}`),
                ...secondExtraConditions.orderBy.map(col => `${secondTableName}.${col}`)
            ];

            orderBy = `ORDER BY ${allOrderBy.join(", ")}`;
        }

        return `${orderBy} ${firstExtraConditions.offset} ${firstExtraConditions.limit}`;
    }

    private extractExtraConditions<SearchDocumentType extends BasicDocument>(conditions: SearchQuery<SearchDocumentType>): { orderBy: string[], limit: string,  offset: string }
    {
        let limit = "";
        if(conditions.limit)
        {
            limit = `LIMIT ${conditions.limit}`;
        }

        let offset = "";
        if(conditions.offset)
        {
            offset = `OFFSET ${conditions.offset}`;
        }

        if(Array.isArray(conditions.orderBy))
        {
            let orders = conditions.orderBy.map((value) => this.parseOrderBy(value));
            if(orders.length > 0)
            {
                return { orderBy: orders, limit, offset };
            }
        }
        else if(conditions.orderBy)
        {
            return {
                orderBy: [ this.parseOrderBy(conditions.orderBy) ],
                limit,
                offset
            }
        }

        return { orderBy: [], limit, offset };
    }

    private parseInnerJoinConditions<SecondDocumentType>(conditions: InnerJoinQuery<DocumentType, SecondDocumentType>, values: Array<any>, secondTableName: string): string
    {
        let conditionsStr = new Array<string>();

        for(let column in conditions.joinConditions)
        {
            if(typeof conditions.joinConditions[column] === "object" && !Array.isArray(conditions.joinConditions[column]))
            {
                let selectors = conditions.joinConditions[column];

                for(let selector in selectors)
                {
                    conditionsStr.push(`
                        ${this.schema.getTableName()}.${column}
                        ${QuerySymbol[selector as QuerySelectorList]}
                        ${secondTableName}.${selectors[selector]}
                    `);
                }
            }
            else
            {
                conditionsStr.push(`
                    ${this.schema.getTableName()}.${column}
                    =
                    ${secondTableName}.${conditions.joinConditions[column]}
                `);
            }
        }

        let allConditions = [
            ...conditionsStr,
            ...this.parseConditions(conditions.firstConditions, values),
            ...this.parseConditions(conditions.secondConditions, values)
        ];

        return allConditions.join(" AND ");
    }

    private parseOrderBy<SearchDocumentType extends BasicDocument>(orderBy: SearchOrder<SearchDocumentType>): string
    {
        return `${orderBy.columnName} ${orderBy.order ? orderBy.order : "desc"}`;
    }
}

export interface InnerJoin<FirstDocumentType extends BasicDocument, SecondDocumentType extends BasicDocument>
{
    firstDocuments?: FirstDocumentType;
    secondDocuments?: SecondDocumentType;
}

type ExcludeBasicModel<DocumentType extends BasicDocument, ModelType extends BasicModel<DocumentType>> = {
    [Property in keyof ModelType as Exclude<Property, keyof BasicModel<DocumentType>>]: ModelType[Property];
};

export type ModelMethods<DocumentType extends BasicDocument, ModelType extends BasicModel<DocumentType>> = {
    [Property in keyof ExcludeBasicModel<DocumentType, ModelType> as If<Property, IsFunction<ModelType[Property]>>]?: ModelType[Property];
};

export default BasicModel;
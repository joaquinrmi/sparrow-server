import { Pool } from "pg";
import { If, IsFunction } from "../conditional";
import BasicDocument, { DocumentAttributes, UpdateDocument } from "./basic_document";
import SearchQuery from "./search_query";
import Schema from "./schema/schema";
import SearchOrder from "./search_order";
import { QuerySelectorList, QuerySymbol } from "./query_selector";
import InnerJoinQuery from "./inner_join_query";

class BasicModel<DocumentType extends BasicDocument>
{
    private schema: Schema<DocumentType>;
    protected columnList: Array<keyof DocumentAttributes<DocumentType>>;
    protected pool: Pool;

    constructor(schema: Schema<DocumentType>, pool: Pool)
    {
        this.schema = schema;
        this.pool = pool;
        this.columnList = [];

        for(let column in this.schema.getDocumentDefinition())
        {
            this.columnList.push(column);
        }
    }

    async initialize(): Promise<void>
    {
        try
        {
            await this.pool.query(this.schema.getCreationInstructions());
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
        let values = [];
        let conditionsStr = this.parseWhere(conditions, values);
        let extraConditionsStr = this.parseExtraConditions(conditions);

        let query = `SELECT 1 FROM ${this.schema.getTableName()} ${conditionsStr} ${extraConditionsStr}`;

        try
        {
            var res = await this.pool.query(query, values);
        }
        catch(err)
        {
            throw err;
        }

        return res.rowCount > 0;
    }

    async create(document: DocumentAttributes<DocumentType>): Promise<DocumentType>
    {
        let columnNames = new Array<string>();
        let values = new Array<any>();

        for(let column in document)
        {
            if(document[column] === undefined)
            {
                continue;
            }
            
            columnNames.push(column);
            values.push(document[column]);
        }

        let query = `INSERT INTO ${this.schema.getTableName()} (${columnNames.join(", ")}) VALUES (${values.map((v, i) => `$${i + 1}`).join(", ")}) RETURNING ${this.columnList.join(", ")}`;

        try
        {
            var res = await this.pool.query(query, values);
        }
        catch(err)
        {
            throw err;
        }

        return this.createDocument(res.rows[0]);
    }

    async delete(conditions: SearchQuery<DocumentType>): Promise<number>
    {
        let values = [];
        let conditionsStr = this.parseWhere(conditions, values);
        let extraConditionsStr = this.parseExtraConditions(conditions);

        let query = `DELETE FROM ${this.schema.getTableName()} ${conditionsStr} ${extraConditionsStr} RETURNING *`;

        try
        {
            var response = await this.pool.query(query, values);
        }
        catch(err)
        {
            throw err;
        }

        return response.rowCount;
    }

    async update(conditions: SearchQuery<DocumentType>, values: UpdateDocument<DocumentType>): Promise<number>
    {
        let queryValues = [];
        let conditionsStr = this.parseWhere(conditions, queryValues);
        let extraConditionsStr = this.parseExtraConditions(conditions);

        let columns = new Array<string>();
        for(let column in values)
        {
            if(typeof values[column] === "object" && !Array.isArray(values[column]))
            {
                columns.push(`${column} = ${(values[column] as { expression: string; }).expression}`)
            }
            else
            {
                columns.push(`${column} = ${queryValues.length + 1}`);
                queryValues.push(values[column]);
            }
        }

        let query = `UPDATE ${this.schema.getTableName()} SET ${columns.join(", ")} ${conditionsStr} ${extraConditionsStr} RETURNING *`;

        try
        {
            var resonse = await this.pool.query(query, queryValues);
        }
        catch(err)
        {
            throw err;
        }

        return resonse.rowCount;
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
            (columnArray as Array<keyof DocumentAttributes<DocumentType>>) = [...this.columnList];
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
            if(data[column] !== undefined)
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
        let whereList = this.parseConditions(conditions, values);
        let where = [];

        for(let i = 0; i < whereList.length; ++i)
        {
            where.push(`(${whereList[i].join(" AND ")})`);
        }

        if(where.length > 0)
        {
            return `WHERE ${where.join(" OR ")}`;
        }

        return "";
    }

    private parseConditions<SearchDocumentType extends BasicDocument>(conditions: SearchQuery<SearchDocumentType>, values: Array<any>): Array<string[]>
    {
        let valueId = values.length + 1;

        let whereProps = new Array<string[]>();

        if(!conditions.props)
        {
            conditions.props = [];
        }

        for(let filter of conditions.props)
        {
            let whereList = new Array<string>();

            for(let prop in filter)
            {
                if(typeof filter[prop] === "object" && !Array.isArray(filter[prop]))
                {
                    let selectors = filter[prop];

                    for(let selector in selectors)
                    {
                        whereList.push(`${prop}${QuerySymbol[selector as QuerySelectorList]}${`$${valueId++}`}`);
                        values.push(selectors[selector]);
                    }
                }
                else
                {
                    whereList.push(`${prop}=${`$${valueId++}`}`);
                    values.push(filter[prop]);
                }
            }

            whereProps.push(whereList);
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

        let firstConditionsParsered = this.parseConditions(conditions.firstConditions, values);
        let secondConditionsParsered = this.parseConditions(conditions.secondConditions, values);

        let firstConditions = new Array<string>();
        let secondConditions = new Array<string>();

        for(let i = 0; i < firstConditionsParsered.length; ++i)
        {
            firstConditionsParsered[i] = firstConditionsParsered[i].map(v => `${this.schema.getTableName()}.${v}`);
            firstConditions.push(`(${firstConditionsParsered[i].join(" AND ")})`);
        }

        for(let i = 0; i < secondConditionsParsered.length; ++i)
        {
            secondConditionsParsered[i] = secondConditionsParsered[i].map(v => `${secondTableName}.${v}`);
            secondConditions.push(`(${secondConditionsParsered[i].join(" AND ")})`);
        }

        let allConditions = `${conditionsStr.join(" AND ")}`;
        if(firstConditions.length > 0)
        {
            allConditions += ` AND (${firstConditions.join("OR")})`;
        }
        if(secondConditions.length > 0)
        {
            allConditions += ` AND (${secondConditions.join("OR")})`;
        }

        return allConditions;
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
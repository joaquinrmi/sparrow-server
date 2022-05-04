import { Pool } from "pg";
import { If, IsFunction } from "../conditional";
import BasicDocument, { DocumentAttributes } from "./basic_document";
import SearchQuery from "./search_query";
import Schema from "./schema/schema";
import SearchOrder from "./search_order";
import { QuerySelectorList, QuerySymbol } from "./query_selector";

class BasicModel<DocumentType extends BasicDocument>
{
    private schema: Schema<DocumentType>;
    private columnList: Array<string>;
    private pool: Pool;

    constructor(schema: Schema<DocumentType>)
    {
        this.schema = schema;

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

        let [ conditionsStr, values ] = this.parseConditions(conditions);

        let query = `SELECT ${selectedColumns} FROM ${this.schema.getTableName()} ${conditionsStr};`;

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

    private createDocument(data: any): DocumentType
    {
        let document: BasicDocument = {};

        for(let column of this.columnList)
        {
            if(data[column])
            {
                document[column] = data[column];
            }
        }

        for(let method in this.schema.methods)
        {
            (document as DocumentType)[method] = this.schema.methods[method];
        }

        return document as DocumentType;
    }

    private parseConditions(conditions: SearchQuery<DocumentType>): [ string, Array<any> ]
    {
        let query = "";
        let values = [];

        let orderBy = "";
        if(Array.isArray(conditions.orderBy))
        {
            let orders = conditions.orderBy.map((value) => this.parseOrderBy(value));
            if(orders.length > 0)
            {
                orderBy = `ORDER BY ${orders.join(", ")}`;
            }
        }
        else if(conditions.orderBy)
        {
            orderBy = `ORDER BY ${this.parseOrderBy(conditions.orderBy)}`;
        }

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

        let valueId = 1;

        let where = "";
        if(conditions.props)
        {
            let whereProps = new Array<string>();
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

            if(whereProps.length > 0)
            {
                where = `WHERE ${whereProps.join(" AND ")}`;
            }
        }

        query = `${where} ${orderBy} ${limit} ${offset}`;

        return [ query, values ];
    }

    private parseOrderBy(orderBy: SearchOrder<DocumentType>): string
    {
        return `${orderBy.columnName} ${orderBy.order ? orderBy.order : "desc"}`;
    }
}

type ExcludeBasicModel<DocumentType extends BasicDocument, ModelType extends BasicModel<DocumentType>> = {
    [Property in keyof ModelType as Exclude<Property, keyof BasicModel<DocumentType>>]: ModelType[Property];
};

export type ModelMethods<DocumentType extends BasicDocument, ModelType extends BasicModel<DocumentType>> = {
    [Property in keyof ExcludeBasicModel<DocumentType, ModelType> as If<Property, IsFunction<ModelType[Property]>>]?: ModelType[Property];
 };

export default BasicModel;
import BasicDocument, { DocumentAttributes, DocumentMethods } from "../basic_document";
import { ColumnDefinition, DocumentDefinition } from "./document_definition";
import { NumericType, VarcharType } from "./postgre_types";

interface ParameterCount
{
    current: number;
}

class Schema<DocumentType extends BasicDocument>
{
    methods: DocumentMethods<DocumentType>;

    private documentDefinition: DocumentDefinition<DocumentType>;
    private tableName: string;
    private creationParameters: Array<any>;

    constructor(tableName: string, documentDefinition: DocumentDefinition<DocumentType>)
    {
        this.methods = {};
        this.tableName = tableName;
        this.documentDefinition = documentDefinition;
        this.creationParameters = [];
    }

    getDocumentDefinition(): DocumentDefinition<DocumentType>
    {
        return this.documentDefinition;
    }

    getTableName(): string
    {
        return this.tableName;
    }

    getCreationInstructions(): string
    {
        let instructions = `CREATE TABLE IF NOT EXISTS ${this.tableName} (`;

        let columnCreationInstructions = new Array<string>();

        let parameterCount: ParameterCount = {
            current: 1
        };

        for(let column in this.documentDefinition)
        {
            columnCreationInstructions.push(this.getColumnCreationInstructions(column, parameterCount));
        }

        instructions += `${columnCreationInstructions.join(", ")});`;

        return instructions;
    }

    getCreationParameters(): Array<any>
    {
        return this.creationParameters;
    }

    private getColumnCreationInstructions(columnName: keyof DocumentAttributes<DocumentType>, parameterCount: ParameterCount): string
    {
        const column = this.documentDefinition[columnName];

        let columnType = this.getColumnType(column.type);
        let primaryKey = this.checkOption("PRIMARY KEY", column.primaryKey);
        let unique = this.checkOption("UNIQUE", column.unique);
        let notNull = this.checkOption("NOT NULL", column.notNull);

        let def = "";
        if(column.default)
        {
            def = `DEFAULT $${parameterCount.current++}`;
            this.creationParameters.push(column.default);
        }

        let references = "";
        if(column.references)
        {
            references = `REFERENCES ${column.references.table}(${column.references.column})`;
        }

        return `${columnName} ${columnType} ${primaryKey} ${unique} ${notNull} ${def} ${references}`;
    }

    private getColumnType(columnType: ColumnDefinition["type"]): string
    {
        if(typeof columnType === "string")
        {
            return columnType;
        }

        if(Array.isArray(columnType))
        {
            return `${this.getColumnType(columnType[0])}[]`;
        }

        if(typeof (columnType as NumericType).precision !== "undefined")
        {
            return `NUMERIC(${(columnType as NumericType).precision}, ${(columnType as NumericType).scale})`;
        }

        if(typeof (columnType as VarcharType).length !== "undefined")
        {
            return `VARCHAR(${(columnType as VarcharType).length})`;
        }
    }

    private checkOption(option: string, exists: boolean): string
    {
        if(exists)
        {
            return option;
        }

        return "";
    }
}

export default Schema;
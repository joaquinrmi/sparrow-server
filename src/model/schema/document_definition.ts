import BasicDocument, { DocumentAttributes } from "../basic_document";
import PostgreType, { NumericType, VarcharType } from "./postgre_types";

export type BasicColumnType = (keyof PostgreType) | NumericType | VarcharType;

export interface ColumnDefinition
{
    type: BasicColumnType | [ BasicColumnType ];
    primaryKey?: boolean;
    unique?: boolean;
    notNull?: boolean;
    default?: any;
    references?: {
        table: string,
        column: string
    }
}

export type DocumentDefinition<DocumentType extends BasicDocument> =
{
    [Property in keyof DocumentAttributes<DocumentType>]: ColumnDefinition
}
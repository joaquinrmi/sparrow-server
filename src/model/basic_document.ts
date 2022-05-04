import { If, IsFunction, Not } from "../conditional";

interface BasicDocument
{}

type ExcludeBasicDocument<DocumentType extends BasicDocument> = {
    [Property in keyof DocumentType as Exclude<Property, keyof BasicDocument>]: DocumentType[Property];
};
 
export type DocumentAttributes<DocumentType extends BasicDocument> = {
    [Property in keyof ExcludeBasicDocument<DocumentType> as If<Property, Not<IsFunction<DocumentType[Property]>>>]: DocumentType[Property];
};
 
export type DocumentMethods<DocumentType extends BasicDocument> = {
    [Property in keyof ExcludeBasicDocument<DocumentType> as If<Property, IsFunction<DocumentType[Property]>>]?: DocumentType[Property];
};

export default BasicDocument;
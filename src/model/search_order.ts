import BasicDocument, { DocumentAttributes } from "./basic_document";

interface SearchOrder<DocumentType extends BasicDocument> {
    columnName: keyof DocumentAttributes<DocumentType>;
    order?: "asc" | "desc";
};

export default SearchOrder;
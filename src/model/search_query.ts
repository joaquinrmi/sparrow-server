import BasicDocument from "./basic_document";
import QueryFilter from "./query_filter";
import SearchOrder from "./search_order";

interface SearchQuery<DocumentType extends BasicDocument>
{
    orderBy?: SearchOrder<DocumentType> | SearchOrder<DocumentType>[];
    limit?: number;
    offset?: number;
    props?: Array<QueryFilter<DocumentType>>;
}

export default SearchQuery;
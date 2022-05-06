import BasicDocument, { DocumentAttributes } from "./basic_document";
import QuerySelector from "./query_selector";
import SearchQuery from "./search_query";

type Condition<T> = T | QuerySelector<T>;

interface InnerJoinQuery<FirstDocumentType extends BasicDocument, SecondDocumentType extends BasicDocument>
{
    joinConditions: {
        [Property in keyof DocumentAttributes<FirstDocumentType>]?: Condition<keyof DocumentAttributes<SecondDocumentType>>;
    };
    firstConditions: SearchQuery<FirstDocumentType>;
    secondConditions: SearchQuery<SecondDocumentType>;
}

export default InnerJoinQuery;
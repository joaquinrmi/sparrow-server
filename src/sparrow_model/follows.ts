import BasicDocument from "../model/basic_document";
import BasicModel from "../model/basic_model";
import Schema from "../model/schema/schema";

interface FollowsDocument extends BasicDocument
{
    id: number;
    user_id: number;
    target_id: number;
}

const followsSchema = new Schema<FollowsDocument>("follows",
{
    id: {
        type: "serial",
        primaryKey: true
    },
    user_id: {
        type: "int",
        notNull: true,
        references: {
            column: "id",
            table: "users"
        }
    },
    target_id: {
        type: "int",
        notNull: true,
        references: {
            column: "id",
            table: "users"
        }
    }
});

class FollowsModel extends BasicModel<FollowsDocument>
{
    constructor(schema: Schema<FollowsDocument>)
    {
        super(schema);
    }
}

export default new FollowsModel(followsSchema);
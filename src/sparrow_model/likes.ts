import BasicDocument from "../model/basic_document";
import BasicModel from "../model/basic_model";
import Schema from "../model/schema/schema";
import cheepsModel from "./cheeps";
import usersModel from "./users";

interface LikesDocument extends BasicDocument
{
    id: number;
    cheep_id: number;
    user_id: number;
}

const likesSchema = new Schema<LikesDocument>("likes",
{
    id: {
        type: "serial",
        primaryKey: true
    },
    cheep_id: {
        type: "int",
        notNull: true,
        references: {
            column: "id",
            table: cheepsModel.getTableName()
        }
    },
    user_id: {
        type: "int",
        notNull: true,
        references: {
            column: "id",
            table: usersModel.getTableName()
        }
    }
});

class LikesModel extends BasicModel<LikesDocument>
{
    constructor(schema: Schema<LikesDocument>)
    {
        super(schema);
    }
}

export default new LikesModel(likesSchema);
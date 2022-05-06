import { Pool } from "pg";
import BasicDocument from "../model/basic_document";
import BasicModel from "../model/basic_model";
import Schema from "../model/schema/schema";

export interface LikesDocument extends BasicDocument
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
            table: "cheeps"
        }
    },
    user_id: {
        type: "int",
        notNull: true,
        references: {
            column: "id",
            table: "users"
        }
    }
});

class LikesModel extends BasicModel<LikesDocument>
{
    constructor(pool: Pool)
    {
        super(likesSchema, pool);
    }
}

export default LikesModel;
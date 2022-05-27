import { Pool } from "pg";
import BasicDocument from "../model/basic_document";
import BasicModel from "../model/basic_model";
import Schema from "../model/schema/schema";

export interface RecheepsDocument extends BasicDocument
{
    id?: number;
    cheep_id: number;
    user_id: number;
}

const recheepsSchema = new Schema<RecheepsDocument>("recheeps",
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

class RecheepsModel extends BasicModel<RecheepsDocument>
{
    constructor(pool: Pool)
    {
        super(recheepsSchema, pool);
    }
}

export default RecheepsModel;
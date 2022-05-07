import { Pool } from "pg";
import BasicDocument from "../model/basic_document";
import BasicModel from "../model/basic_model";
import Schema from "../model/schema/schema";

export interface SessionsDocument extends BasicDocument
{
    id?: number;
    user_id: number;
    key: string;
    date: number;
}

const sessionsSchema = new Schema<SessionsDocument>("sessions",
{
    id: {
        type: "serial",
        notNull: true
    },
    user_id: {
        type: "int",
        notNull: true,
        references: {
            column: "id",
            table: "users"
        }
    },
    key: {
        type: "text",
        notNull: true
    },
    date: {
        type: "bigint",
        notNull: true
    }
});

class SessionsModel extends BasicModel<SessionsDocument>
{
    constructor(pool: Pool)
    {
        super(sessionsSchema, pool);
    }
}

export default SessionsModel;
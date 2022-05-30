import { Pool } from "pg";
import BasicDocument from "../model/basic_document";
import BasicModel from "../model/basic_model";
import Schema from "../model/schema/schema";
import randomWord from "../random_word";
import { encrypt, decrypt } from "../encryption";

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

    async registerNewSession(userId: number): Promise<string>
    {
        const key = randomWord(16);

        try
        {
            await this.create({
                user_id: userId,
                key: key,
                date: new Date().getTime()
            });
        }
        catch(err)
        {
            throw err;
        }

        return encrypt(key);
    }

    async checkSession(userId: number, sessionKey: string): Promise<boolean>
    {
        try
        {
            return this.exists({
                props: [
                    {
                        user_id: userId,
                        key: decrypt(sessionKey)
                    }
                ]
            });
        }
        catch(err)
        {
            throw err;
        }
    }

    async unregisterSession(userId: number, key: string): Promise<void>
    {
        try
        {
            await this.delete({
                props: [
                    {
                        user_id: userId,
                        key: decrypt(key)
                    }
                ]
            });
        }
        catch(err)
        {
            throw err;
        }
    }
}

export default SessionsModel;
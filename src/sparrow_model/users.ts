import { Pool } from "pg";
import { encrypt } from "../encryption";
import BasicDocument from "../model/basic_document";
import BasicModel from "../model/basic_model";
import Schema from "../model/schema/schema";

export interface UsersDocument extends BasicDocument
{
    id?: number;
    handle: string;
    email: string;
    password: string;
    profile_id: number;
}

const usersSchema = new Schema<UsersDocument>("users",
{
    id: {
        type: "serial",
        primaryKey: true
    },
    handle: {
        type: "text",
        unique: true,
        notNull: true
    },
    email: {
        type: "text",
        unique: true,
        notNull: true
    },
    password: {
        type: "text",
        notNull: true
    },
    profile_id: {
        type: "int",
        unique: true,
        notNull: true,
        references: {
            column: "id",
            table: "profiles"
        }
    }
});

class UsersModel extends BasicModel<UsersDocument>
{
    constructor(pool: Pool)
    {
        super(usersSchema, pool);
    }

    async validate(handleOrEmail: string, password: string): Promise<UsersDocument>
    {
        let encryptedPassword = encrypt(password);

        try
        {
            var res = await this.find({
                props: [
                    {
                        handle: handleOrEmail,
                        password: encryptedPassword
                    },
                    {
                        email: handleOrEmail,
                        password: encryptedPassword
                    }
                ]
            });
        }
        catch(err)
        {
            throw err;
        }

        if(res.length > 0)
        {
            return res[0];
        }
        else
        {
            return null;
        }
    }
}

export default UsersModel;
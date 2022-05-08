import { Pool } from "pg";
import BasicDocument from "../model/basic_document";
import BasicModel from "../model/basic_model";
import Schema from "../model/schema/schema";
import UsersModel from "./users";

export interface ProfilesDocument extends BasicDocument
{
    id?: number;
    name: string;
    picture: string;
    banner?: string;
    join_date: number;
    birth_date?: number;
    location?: string;
    website?: string;
    following?: number;
    followers?: number;
    cheeps?: number;
}

const profilesSchema = new Schema<ProfilesDocument>("profiles",
{
    id: {
        type: "serial",
        primaryKey: true
    },
    name: {
        type: "text",
        notNull: true
    },
    picture: {
        type: "text",
        notNull: true
    },
    banner: {
        type: "text"
    },
    join_date: {
        type: "bigint",
        notNull: true
    },
    birth_date: {
        type: "bigint"
    },
    location: {
        type: "text"
    },
    website: {
        type: "text"
    },
    following: {
        type: "int",
        notNull: true,
        default: 0
    },
    followers: {
        type: "int",
        notNull: true,
        default: 0
    },
    cheeps: {
        type: "int",
        notNull: true,
        default: 0
    }
});

class ProfilesModel extends BasicModel<ProfilesDocument>
{
    constructor(pool: Pool)
    {
        super(profilesSchema, pool);
    }

    async registerNewCheep(userId: string, usersModel: UsersModel): Promise<void>
    {
        try
        {
            await this.pool.query(`UPDATE ${this.getTableName()} SET cheeps = cheeps + 1 FROM ${this.getTableName()} a INNER JOIN ${usersModel.getTableName()} b ON b.id = $1 AND a.id = b.profile_id`, [ userId ]);
        }
        catch(err)
        {
            throw err;
        }
    }
}

export default ProfilesModel;
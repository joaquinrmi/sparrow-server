import { Pool } from "pg";
import BasicDocument from "../model/basic_document";
import BasicModel from "../model/basic_model";
import Schema from "../model/schema/schema";
import UsersModel from "./users";
import UserCellInfo from "./user_cell_info";

export interface FollowsDocument extends BasicDocument
{
    id?: number;
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
    constructor(pool: Pool)
    {
        super(followsSchema, pool);
    }

    async registerFollow(userId: number, targetId: number): Promise<void>
    {
        try
        {
            await this.create({
                user_id: userId,
                target_id: targetId
            });
        }
        catch(err)
        {
            throw err;
        }
    }

    async getFollowers(currentUserId: number, userHandle: string, offset: number, usersModel: UsersModel): Promise<{
        users: Array<UserCellInfo>,
        offset: number
    }>
    {
        try
        {
            var documents = await usersModel.find(
                {
                    props: [
                        {
                            handle: userHandle
                        }
                    ]
                },
                [ "id" ]
            );
        }
        catch(err)
        {
            throw err;
        }

        if(documents.length === 0)
        {
            return null;
        }

        let userId = documents[0].id;

        const query = `
            SELECT follows.id, users.id AS user_id, users.handle, profiles.name, profiles.picture, profiles.description
            FROM follows
            INNER JOIN users ON users.id = follows.user_id
            INNER JOIN profiles ON profiles.id = users.profile_id
            WHERE follows.target_id = $1 AND follows.id > $2
            LIMIT 20;
        `;

        try
        {
            var response = await this.pool.query(query, [ userId, offset ]);
        }
        catch(err)
        {
            throw err;
        }

        let users = new Array<UserCellInfo>();

        if(response.rowCount === 0)
        {
            return {
                users: users,
                offset: Number.MAX_SAFE_INTEGER
            }
        }

        for(let i = 0; i < response.rowCount; ++i)
        {
            users.push(await this.createUserCellInfo(response.rows[i], currentUserId));
        }

        let newOffset = response.rows[response.rowCount - 1].id;

        return {
            users: users,
            offset: newOffset
        };
    }

    async getFollowing(currentUserId: number, userHandle: string, offset: number, usersModel: UsersModel): Promise<{
        users: Array<UserCellInfo>,
        offset: number
    }>
    {
        try
        {
            var documents = await usersModel.find(
                {
                    props: [
                        {
                            handle: userHandle
                        }
                    ]
                },
                [ "id" ]
            );
        }
        catch(err)
        {
            throw err;
        }

        if(documents.length === 0)
        {
            return null;
        }

        let userId = documents[0].id;

        const query = `
            SELECT follows.id, users.id AS user_id, users.handle, profiles.name, profiles.picture, profiles.description
            FROM follows
            INNER JOIN users ON users.id = follows.target_id
            INNER JOIN profiles ON profiles.id = users.profile_id
            WHERE follows.user_id = $1 AND follows.id > $2
            LIMIT 20;
        `;

        try
        {
            var response = await this.pool.query(query, [ userId, offset ]);
        }
        catch(err)
        {
            throw err;
        }

        let users = new Array<UserCellInfo>();

        if(response.rowCount === 0)
        {
            return {
                users: users,
                offset: Number.MAX_SAFE_INTEGER
            }
        }

        for(let i = 0; i < response.rowCount; ++i)
        {
            users.push(await this.createUserCellInfo(response.rows[i], currentUserId));
        }

        let newOffset = response.rows[response.rowCount - 1].id;

        return {
            users: users,
            offset: newOffset
        };
    }

    private async createUserCellInfo(row: any, userId: number): Promise<UserCellInfo>
    {
        try
        {
            var exists = await this.exists({
                props: [
                    {
                        user_id: userId,
                        target_id: row.user_id
                    }
                ]
            });
        }
        catch(err)
        {
            throw err;
        }

        return {
            handle: row.handle,
            name: row.name,
            picture: row.picture,
            description: row.description,
            following: exists
        };
    }
}

export default FollowsModel;
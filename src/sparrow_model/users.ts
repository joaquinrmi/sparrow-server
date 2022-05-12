import { Pool } from "pg";
import { encrypt } from "../encryption";
import BasicDocument from "../model/basic_document";
import BasicModel from "../model/basic_model";
import Schema from "../model/schema/schema";
import FollowsModel from "./follows";
import ProfilesModel from "./profiles";

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

    async getShortInformation(id: number, profilesModel: ProfilesModel): Promise<UserShortInformation>
    {
        try
        {
            var userDocuments = await this.find({
                props: [
                    {
                        id: id
                    }
                ]
            }, [ "id", "handle", "profile_id" ]);
        }
        catch(err)
        {
            throw err;
        }

        if(userDocuments.length === 0)
        {
            return null;
        }

        const user = userDocuments[0];

        try
        {
            var profileDocuments = await profilesModel.find({
                props: [
                    {
                        id: user.profile_id
                    }
                ]
            }, [ "name", "picture" ]);
        }
        catch(err)
        {
            throw err;
        }

        if(profileDocuments.length === 0)
        {
            return null;
        }

        const profile = profileDocuments[0];

        return {
            handle: user.handle,
            name: profile.name,
            picture: profile.picture
        };
    }

    async follow(userId: number, targetId: number, followsModel: FollowsModel): Promise<boolean>
    {
        const updateProfileQuery = `
            UPDATE profiles
            SET profiles.following = profiles.following + 1
            FROM profiles INNER JOIN users ON profiles.id = users.profile_id
            WHERE users.id = $1;
        `;

        const updateTargetQuery = `
            UPDATE profiles
            SET profiles.followers = profiles.followers + 1
            FROM profiles INNER JOIN users ON profiles.id = users.profile_id
            WHERE users.id = $1
            RETURNING *;
        `;

        try
        {
            var utResponse = await this.pool.query(updateTargetQuery, [ targetId ]);
        }
        catch(err)
        {
            throw err;
        }

        if(utResponse.rowCount === 0)
        {
            return false;
        }

        try
        {
            await this.pool.query(updateProfileQuery, [ userId ]);
            await followsModel.registerFollow(userId, targetId);

        }
        catch(err)
        {
            throw err;
        }

        return true;
    }

    async unfollow(userId: number, targetId: number, followsModel: FollowsModel): Promise<boolean>
    {
        const updateProfileQuery = `
            UPDATE profiles
            SET profiles.following = profiles.following - 1
            FROM profiles INNER JOIN users ON profiles.id = users.profile_id
            WHERE users.id = $1;
        `;

        const updateTargetQuery = `
            UPDATE profiles
            SET profiles.followers = profiles.followers - 1
            FROM profiles INNER JOIN users ON profiles.id = users.profile_id
            WHERE users.id = $1
            RETURNING *;
        `;

        try
        {
            var utResponse = await this.pool.query(updateTargetQuery, [ targetId ]);
        }
        catch(err)
        {
            throw err;
        }

        if(utResponse.rowCount === 0)
        {
            return false;
        }

        try
        {
            await this.pool.query(updateProfileQuery, [ userId ]);
            await followsModel.delete({
                props: [
                    {
                        user_id: userId,
                        target_id: targetId
                    }
                ]
            });
        }
        catch(err)
        {
            throw err;
        }

        return true;
    }
}

export interface UserShortInformation
{
    handle: string;
    name: string;
    picture: string;
}

export default UsersModel;
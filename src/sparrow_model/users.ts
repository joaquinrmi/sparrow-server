import { Pool } from "pg";
import { decrypt, encrypt } from "../encryption";
import BasicDocument, { DocumentAttributes } from "../model/basic_document";
import BasicModel from "../model/basic_model";
import Schema from "../model/schema/schema";
import FollowsModel from "./follows";
import ProfilesModel, { ProfilesDocument } from "./profiles";
import SparrowModel from "./sparrow_model";

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
    private model: SparrowModel;

    constructor(pool: Pool, model: SparrowModel)
    {
        super(usersSchema, pool);

        this.model = model;
    }

    async validate(handleOrEmail: string, password: string): Promise<UsersDocument>
    {
        try
        {
            var res = await this.find({
                props: [
                    {
                        handle: handleOrEmail
                    },
                    {
                        email: handleOrEmail
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
            if(decrypt(res[0].password) !== password)
            {
                return null;
            }

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

    async follow(userId: number, targetHandle: string, followsModel: FollowsModel): Promise<boolean>
    {
        try
        {
            var tuDoc = await this.find(
                {
                    props: [
                        {
                            handle: targetHandle
                        }
                    ]
                },
                [ "id", "profile_id" ]
            );
        }
        catch(err)
        {
            throw err;
        }

        if(tuDoc.length === 0)
        {
            return false;
        }

        const targetId = tuDoc[0].id;
        const targetProfileId = tuDoc[0].profile_id;

        try
        {
            var userDoc = await this.find(
                {
                    props: [
                        {
                            id: userId
                        }
                    ]
                },
                [ "profile_id" ]
            );
        }
        catch(err)
        {
            throw err;
        }

        if(userDoc.length === 0)
        {
            return false;
        }

        const userProfileId = userDoc[0].profile_id;

        if(await followsModel.exists({
            props: [
                {
                    user_id: userId,
                    target_id: targetId
                }
            ]
        }))
        {
            return false;
        }

        const updateProfileQuery = `
            UPDATE profiles
            SET following = following + 1
            WHERE id = $1;
        `;

        const updateTargetQuery = `
            UPDATE profiles
            SET followers = followers + 1
            WHERE id = $1
            RETURNING *;
        `;

        try
        {
            var utResponse = await this.pool.query(updateTargetQuery, [ targetProfileId ]);
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
            await this.pool.query(updateProfileQuery, [ userProfileId ]);
            await followsModel.registerFollow(userId, targetId);

        }
        catch(err)
        {
            throw err;
        }

        return true;
    }

    async unfollow(userId: number, targetHandle: string, followsModel: FollowsModel): Promise<boolean>
    {
        try
        {
            var tuDoc = await this.find(
                {
                    props: [
                        {
                            handle: targetHandle
                        }
                    ]
                },
                [ "id", "profile_id" ]
            );
        }
        catch(err)
        {
            throw err;
        }

        if(tuDoc.length === 0)
        {
            return false;
        }

        const targetId = tuDoc[0].id;
        const targetProfileId = tuDoc[0].profile_id;

        try
        {
            var userDoc = await this.find(
                {
                    props: [
                        {
                            id: userId
                        }
                    ]
                },
                [ "profile_id" ]
            );
        }
        catch(err)
        {
            throw err;
        }

        if(userDoc.length === 0)
        {
            return false;
        }

        const userProfileId = userDoc[0].profile_id;

        if(!await followsModel.exists({
            props: [
                {
                    user_id: userId,
                    target_id: targetId
                }
            ]
        }))
        {
            return false;
        }

        const updateProfileQuery = `
            UPDATE profiles
            SET following = following - 1
            WHERE id = $1;
        `;

        const updateTargetQuery = `
            UPDATE profiles
            SET followers = followers - 1
            WHERE id = $1
            RETURNING *;
        `;

        try
        {
            var utResponse = await this.pool.query(updateTargetQuery, [ targetProfileId ]);
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
            await this.pool.query(updateProfileQuery, [ userProfileId ]);
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
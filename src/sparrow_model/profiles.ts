import { Pool } from "pg";
import BasicDocument from "../model/basic_document";
import BasicModel from "../model/basic_model";
import Schema from "../model/schema/schema";
import EditProfileForm from "../routes/profiles/edit_profile_form";
import SparrowModel from "./sparrow_model";
import UsersModel from "./users";

export interface ProfilesDocument extends BasicDocument
{
    id?: number;
    name: string;
    picture: string;
    banner?: string;
    description?: string;
    join_date: number;
    birthdate?: number;
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
    description: {
        type: "text"
    },
    join_date: {
        type: "bigint",
        notNull: true
    },
    birthdate: {
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
    private model: SparrowModel;

    constructor(pool: Pool, model: SparrowModel)
    {
        super(profilesSchema, pool);

        this.model = model;
    }

    async getUserProfileData(currentUserId: number, userHandle: string): Promise<UserProfileData>
    {
        const followingQuery = `SELECT count(f.id) FROM follows AS f INNER JOIN users AS u ON f.target_id = u.id WHERE f.user_id = $1 AND u.handle = $2`;

        const query = `SELECT ${this.columnList.map(column => `p.${column}`).join(", ")}, (${followingQuery} > 0) AS user_follows_them FROM profiles AS p INNER JOIN users AS u ON p.id = u.profile_id WHERE u.handle = $2`;

        try
        {
            var response = await this.pool.query(query, [ currentUserId, userHandle ]);
        }
        catch(err)
        {
            throw err;
        }

        if(response.rowCount === 0)
        {
            return null;
        }

        const currentUser = await this.model.usersModel.exists({
            props: [
                {
                    id: currentUserId,
                    handle: userHandle
                }
            ]
        });

        const profileData = response.rows[0];

        return {
            name: profileData.name,
            picture: profileData.picture,
            banner: profileData.banner === null ? undefined : profileData.banner,
            description: profileData.description === null ? undefined : profileData.description,
            joinDate: profileData.join_date,
            birthdate: currentUser ? profileData.birthdate : undefined,
            location: profileData.location,
            website: profileData.website,
            followingCount: profileData.following,
            followerCount: profileData.followers,
            cheepCount: profileData.cheeps,
            following: profileData.user_follows_them,
        };
    }

    async registerNewCheep(userId: number): Promise<void>
    {
        try
        {
            var documents = await this.model.usersModel.find(
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

        if(documents.length === 0)
        {
            return;
        }

        const profileId = documents[0].profile_id;

        try
        {
            await this.update(
                {
                    props: [
                        {
                            id: profileId
                        }
                    ]
                },
                {
                    cheeps: {
                        expression: "cheeps + 1"
                    }
                }
            );
        }
        catch(err)
        {
            throw err;
        }
    }

    async edit(userId: number, data: EditProfileForm): Promise<void>
    {
        try
        {
            var documents = await this.model.usersModel.find({
                props: [
                    {
                        id: userId
                    }
                ]
            });
        }
        catch(err)
        {
            throw err;
        }

        if(documents.length === 0)
        {
            return;
        }

        let dataToSend: EditProfileForm = {};
        for(let key in data)
        {
            if(data[key] !== undefined)
            {
                dataToSend[key] = data[key];
            }
        }

        try
        {
            await this.update(
                {
                    props: [
                        {
                            id: documents[0].profile_id
                        }
                    ]
                },
                dataToSend
            );
        }
        catch(err)
        {
            throw err;
        }
    }
}

export interface UserProfileData
{
    name: string;
    picture: string;
    banner?: string;
    description?: string;
    joinDate: number;
    birthdate?: number;
    location: string;
    website: string;
    followingCount: number;
    followerCount: number;
    cheepCount: number;
    following: boolean;
}

export default ProfilesModel;
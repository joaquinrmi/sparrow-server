import { Pool } from "pg";
import { decrypt, encrypt } from "../encryption";
import path from "path";
import ImageKeeper from "../image_keeper";
import BasicDocument, { DocumentAttributes } from "../model/basic_document";
import BasicModel from "../model/basic_model";
import Schema from "../model/schema/schema";
import FollowsModel from "./follows";
import ProfilesModel, { ProfilesDocument } from "./profiles";
import SparrowModel from "./sparrow_model";
import UserCellInfo from "./user_cell_info";
import SearchUsersForm from "../routes/users/search_users_form";
import UnavailableHandle from "./users_error";
import { DBError } from "./model_error";

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
    private reservedWords: Array<string>;

    constructor(pool: Pool, model: SparrowModel)
    {
        super(usersSchema, pool);

        this.model = model;

        this.reservedWords = [
            "home", "explore", "notifications", "messages", "bookmarks", "compose", "recommended", "search", "settings", "status", "signup", "login"
        ];
    }

    async createNewUser(profileData: DocumentAttributes<ProfilesDocument>, userData: DocumentAttributes<UsersDocument>): Promise<UsersDocument>
    {
        if(this.reservedWords.indexOf(userData.handle.toLowerCase()) !== -1)
        {
            throw new UnavailableHandle();
        }

        try
        {
            var checkUser = await this.pool.query(
                `SELECT u.id FROM users AS u WHERE LOWER(u.handle) = $1`,
                [ userData.handle.toLocaleLowerCase() ]
            );
        }
        catch(err)
        {
            throw new DBError(err);
        }

        if(checkUser.rowCount > 0)
        {
            throw new UnavailableHandle();
        }

        const client = await this.pool.connect();

        try
        {
            await client.query("BEGIN");

            var profileDocument = await this.model.profilesModel.create(
                {
                    name: profileData.name,
                    birthdate: profileData.birthdate,
                    picture: "",
                    join_date: new Date().getTime()
                },
                client
            );

            var userDocument = await this.create(
                {
                    handle: userData.handle,
                    email: userData.email,
                    password: encrypt(userData.password),
                    profile_id: profileDocument.id
                },
                client
            );

            const imageKeeper = new ImageKeeper(userDocument.id);
            const defaultPicPath = path.join(__dirname, "..", "..", "img", "profile_default.png");

            const profilePic = (await imageKeeper.saveProfilePicture(defaultPicPath)).replace("http://", "https://");

            await this.model.profilesModel.update(
                {
                    props: [
                        {
                            id: profileDocument.id
                        }
                    ]
                },
                {
                    picture: profilePic
                },
                client
            );

            await client.query("COMMIT");
        }
        catch(err)
        {
            await client.query("ROLLBACK");

            throw new DBError(err);
        }
        finally
        {
            client.release();
        }

        return userDocument;
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

    async getRecommendedList(currentUserId: number, offsetId: number): Promise<Array<UserCellInfo>>
    {
        const followQuery = `SELECT f.id FROM follows AS f WHERE f.user_id = $1 AND f.target_id = u.id`;

        const query = `
            SELECT u.id AS user_id, u.handle, p.name, p.picture, p.description
            FROM users AS u
            INNER JOIN profiles AS p ON p.id = u.profile_id
            WHERE u.id != $1 AND u.id < $2 AND NOT EXISTS (${followQuery})
            ORDER BY u.id DESC
            LIMIT 20
        `;

        try
        {
            var response = await this.pool.query(query, [ currentUserId, offsetId ]);
        }
        catch(err)
        {
            throw err;
        }

        let users = new Array<UserCellInfo>();

        if(response.rowCount === 0)
        {
            return users;
        }

        for(let i = 0; i < response.rowCount; ++i)
        {
            users.push(await this.model.followsModel.createUserCellInfo(response.rows[i], currentUserId));
        }

        return users;
    }

    async searchUsers(currentUserId: number, options: SearchUsersForm): Promise<Array<UserCellInfo>>
    {
        let values = new Array<any>();
        let where = new Array<string>();

        if(options.nameOrHandle !== undefined)
        {
            const words = options.nameOrHandle.map((word) => `%${word.toLowerCase()}%`).join("|");

            where.push(`
                (LOWER(u.handle) SIMILAR TO '${words}' OR
                LOWER(p.name) SIMILAR TO '${words}')
            `);
        }

        if(options.offsetId !== undefined)
        {
            values.push(options.offsetId);
            where.push(`u.id < $${values.length}`);
        }

        const query = `
            SELECT u.id AS user_id, u.handle, p.name, p.picture, p.description
            FROM users AS u
            INNER JOIN profiles as p ON p.id = u.profile_id
            ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""}
            ORDER BY u.id DESC
            LIMIT 20
        `;

        try
        {
            var response = await this.pool.query(query, values);
        }
        catch(err)
        {
            throw err;
        }

        let users = new Array<UserCellInfo>();

        if(response.rowCount === 0)
        {
            return users;
        }

        for(let i = 0; i < response.rowCount; ++i)
        {
            users.push(await this.model.followsModel.createUserCellInfo(response.rows[i], currentUserId));
        }

        return users;
    }

    async getUsersLike(currentUserId: number, likeTarget: number, offsetId: number): Promise<Array<UserCellInfo>>
    {
        let values = [ likeTarget ];

        const where = [ "l.cheep_id = $1" ];

        if(offsetId !== undefined)
        {
            values.push(offsetId);
            where.push(`l.id < $${values.length}`);
        }

        const query = `
            SELECT l.id AS offset_id, u.handle, p.name, p.picture, p.description
            FROM users AS u
            INNER JOIN profiles AS p ON p.id = u.profile_id
            INNER JOIN likes AS l ON l.user_id = u.id
            WHERE ${where.join(" AND ")}
            ORDER BY l.id DESC
            LIMIT 20
        `;
        
        try
        {
            var response = await this.pool.query(query, values);
        }
        catch(err)
        {
            throw err;
        }

        let users = new Array<UserCellInfo>();

        if(response.rowCount === 0)
        {
            return users;
        }

        for(let i = 0; i < response.rowCount; ++i)
        {
            users.push(await this.model.followsModel.createUserCellInfo(response.rows[i], currentUserId));
        }

        return users;
    }

    async getUsersRecheep(currentUserId: number, recheepTarget: number, offsetId: number): Promise<Array<UserCellInfo>>
    {
        let values = [ recheepTarget ];

        const where = [ "r.cheep_id = $1" ];

        if(offsetId !== undefined)
        {
            values.push(offsetId);
            where.push(`r.id < $${values.length}`);
        }

        const query = `
            SELECT r.id AS offset_id, u.handle, p.name, p.picture, p.description
            FROM users AS u
            INNER JOIN profiles AS p ON p.id = u.profile_id
            INNER JOIN recheeps AS r ON r.user_id = u.id
            WHERE ${where.join(" AND ")}
            ORDER BY r.id DESC
            LIMIT 20
        `;
        
        try
        {
            var response = await this.pool.query(query, values);
        }
        catch(err)
        {
            throw err;
        }

        let users = new Array<UserCellInfo>();

        if(response.rowCount === 0)
        {
            return users;
        }

        for(let i = 0; i < response.rowCount; ++i)
        {
            users.push(await this.model.followsModel.createUserCellInfo(response.rows[i], currentUserId));
        }

        return users;
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

        if(await followsModel.exists({
            props: [
                {
                    user_id: userId,
                    target_id: targetId
                }
            ]
        }))
        {
            return true;
        }

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

        if(!await followsModel.exists({
            props: [
                {
                    user_id: userId,
                    target_id: targetId
                }
            ]
        }))
        {
            return true;
        }

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
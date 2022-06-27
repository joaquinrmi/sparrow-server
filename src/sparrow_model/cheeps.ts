import { Pool, PoolClient } from "pg";
import BasicDocument from "../model/basic_document";
import BasicModel from "../model/basic_model";
import Schema from "../model/schema/schema";
import SparrowModel from "./sparrow_model";

export interface CheepsDocument extends BasicDocument
{
    id?: number;
    author_id: number;
    date_created: number;
    response_target?: number;
    quote_target?: number;
    content?: string;
    gallery?: Array<string>;
    comments?: number;
    recheeps?: number;
    quotes?: number;
    likes?: number;
}

const cheepsSchema = new Schema<CheepsDocument>("cheeps",
{
    id: {
        type: "serial",
        primaryKey: true
    },
    author_id: {
        type: "int",
        notNull: true,
        references: {
            column: "id",
            table: "users"
        }
    },
    date_created: {
        type: "bigint",
        notNull: true
    },
    response_target: {
        type: "int",
        references: {
            column: "id",
            table: "cheeps"
        }
    },
    quote_target: {
        type: "int",
        references: {
            column: "id",
            table: "cheeps"
        }
    },
    content: {
        type: "text"
    },
    gallery: {
        type: [ "text" ]
    },
    comments: {
        type: "int",
        notNull: true,
        default: 0
    },
    recheeps: {
        type: "int",
        notNull: true,
        default: 0
    },
    quotes: {
        type: "int",
        notNull: true,
        default: 0
    },
    likes: {
        type: "int",
        notNull: true,
        default: 0
    }
});

class CheepsModel extends BasicModel<CheepsDocument>
{
    private cheepDataColumns: Array<string>;
    private model: SparrowModel;

    constructor(pool: Pool, sparrowModel: SparrowModel)
    {
        super(cheepsSchema, pool);

        let cheepColumns = this.columnList.map(column => `cheeps.${column}`);
        let userColumns = [ "users.handle" ];
        let profileColumns = [ "profiles.name", "profiles.picture" ];

        this.cheepDataColumns = [
            ...cheepColumns,
            ...userColumns,
            ...profileColumns
        ];

        this.model = sparrowModel;
    }

    async cheep(data: CheepsDocument): Promise<CheepsDocument | null>
    {
        const client = await this.pool.connect();

        try
        {
            await client.query("BEGIN");

            var cheepDocument = await this.create(data, client);
            await this.model.profilesModel.registerNewCheep(data.author_id, client);

            if(data.quote_target !== undefined)
            {
                if(data.content === undefined && data.gallery === undefined)
                {
                    if(!(await this.registerNewRecheep(data.author_id, data.quote_target, client)))
                    {
                        return null;
                    }
                }
                else
                {
                    await this.registerNewQuote(data.quote_target, client);
                }
            }

            if(data.response_target !== null)
            {
                await this.registerNewComment(data.response_target, client);
            }

            await client.query("COMMIT");
        }
        catch(err)
        {
            await client.query("ROLLBACK");

            throw err;
        }
        finally
        {
            client.release();
        }

        return cheepDocument;
    }

    async deleteCheep(userId: number, cheepId: number): Promise<boolean>
    {
        try
        {
            var cheeps = await this.find({
                props: [
                    {
                        id: cheepId,
                        author_id: userId
                    }
                ]
            });
        }
        catch(err)
        {
            throw err;
        }

        if(cheeps.length === 0)
        {
            return false;
        }

        const cheepDocument = cheeps[0];

        const client = await this.pool.connect();

        try
        {
            await client.query("BEGIN");

            if(cheepDocument.quote_target !== null)
            {
                if(cheepDocument.content !== null || cheepDocument.gallery !== null)
                {
                    await this.unregisterQuote(cheepDocument.quote_target, client);
                }
                else
                {
                    await this.unregisterRecheep(cheepDocument.author_id, cheepDocument.quote_target, client);
                }
            }

            if(cheepDocument.response_target !== null)
            {
                await this.unregisterComment(cheepDocument.response_target, client);
            }

            var updateCount = await this.voidCheep(cheepId, userId, client);
            if(updateCount > 0)
            {
                await this.model.profilesModel.unregisterCheep(userId, client);
            }

            await client.query("COMMIT");
        }
        catch(err)
        {
            await client.query("ROLLBACK");

            throw err;
        }
        finally
        {
            client.release();
        }

        return updateCount > 0;
    }

    async deleteRecheep(userId: number, targetId: number): Promise<boolean>
    {
        try
        {
            const cheepDocuments = await this.find(
                {
                    props: [
                        {
                            author_id: userId,
                            quote_target: targetId
                        }
                    ]
                },
                [ "id" ]
            );

            if(cheepDocuments.length === 0)
            {
                return false;
            }

            const cheep = cheepDocuments[0];

            if(await this.deleteCheep(userId, cheep.id))
            {
                await this.model.profilesModel.unregisterCheep(userId);
                return true;
            }
            else
            {
                return false;
            }
        }
        catch(err)
        {
            throw err;
        }
    }

    async searchCheeps(currentUserId: number, parameters: SearchCheepsParameters): Promise<Array<CheepData>>
    {
        let values: Array<any> = [];

        let whereConditions = new Array<string>();

        if(parameters.words.length > 0)
        {
            const words = parameters.words.map((word) => `%${word.toLowerCase()}%`).join("|");
            whereConditions.push(`LOWER(cheeps.content) SIMILAR TO '${words}'`);
        }

        values.push(parameters.maxTime);
        whereConditions.push(`cheeps.date_created > -1 AND cheeps.date_created < $${values.length}`);

        if(!parameters.responses)
        {
            whereConditions.push(`cheeps.response_target IS NULL`);
        }

        if(parameters.onlyGallery)
        {
            whereConditions.push(`cheeps.gallery IS NOT NULL`);
        }

        if(parameters.responseOf !== -1)
        {
            whereConditions.push(`cheeps.response_target = $${values.length + 1}`);
            values.push(parameters.responseOf);
        }

        if(parameters.userHandle !== undefined)
        {
            whereConditions.push(`users.handle = $${values.length + 1}`);
            values.push(parameters.userHandle);
        }

        if(parameters.quoteTarget !== undefined)
        {
            whereConditions.push(`(cheeps.quote_target = $${values.length + 1} AND (cheeps.content IS NOT NULL OR cheeps.gallery IS NOT NULL))`);
            values.push(parameters.quoteTarget);
        }

        let recheepJoin = "";
        if(parameters.recheepTarget !== undefined)
        {
            whereConditions.push(`recheeps.cheep_id = $${values.length + 1}`);
            values.push(parameters.recheepTarget);

            recheepJoin = `INNER JOIN recheeps ON recheeps.user_id = users.id`;
        }

        let query = `SELECT ${this.cheepDataColumns.join(", ")} FROM cheeps
            INNER JOIN users ON users.id = cheeps.author_id
            INNER JOIN profiles ON profiles.id = users.profile_id
            ${recheepJoin}
            WHERE ${whereConditions.join(" AND ")}
            ORDER BY cheeps.date_created DESC LIMIT 20;`;

        try
        {
            var response = await this.pool.query(query, values);
        }
        catch(err)
        {
            throw err;
        }

        let result = new Array<CheepData>();

        for(let i = 0; i < response.rowCount; ++i)
        {
            result.push(await this.createCheepData(currentUserId, response.rows[i]));
        }

        return result;
    }

    async getCheep(currentUserId: number, cheepId: number): Promise<CheepData>
    {
        let query = `SELECT ${this.cheepDataColumns.join(", ")} FROM cheeps
            INNER JOIN users ON users.id = cheeps.author_id
            INNER JOIN profiles ON profiles.id = users.profile_id
            WHERE cheeps.id = $1;`;

        try
        {
            var response = await this.pool.query(query, [ cheepId ]);
        }
        catch(err)
        {
            throw err;
        }

        if(response.rowCount === 0)
        {
            return null;
        }

        return this.createCheepData(currentUserId, response.rows[0]);
    }

    async getTimeline(currentUserId: number, userId: number, maxTime: number): Promise<Array<CheepData>>
    {
        const query = `SELECT ${this.cheepDataColumns.join(", ")} FROM follows
            INNER JOIN cheeps ON cheeps.author_id = follows.target_id
            INNER JOIN users ON users.id = follows.target_id
            INNER JOIN profiles ON profiles.id = users.profile_id
            WHERE follows.user_id = $1 AND cheeps.date_created > -1 AND cheeps.date_created < $2
            ORDER BY cheeps.date_created DESC LIMIT 20;`;

        try
        {
            var response = await this.pool.query(query, [ userId, maxTime ]);
        }
        catch(err)
        {
            throw err;
        }

        let result = new Array<CheepData>();

        for(let i = 0; i < response.rowCount; ++i)
        {
            result.push(await this.createCheepData(currentUserId, response.rows[i]));
        }

        return result;
    }

    async getAll(currentUserId: number, maxTime: number): Promise<Array<CheepData>>
    {
        const query = `
            SELECT ${this.cheepDataColumns.join(", ")} FROM cheeps
            INNER JOIN users ON users.id = cheeps.author_id
            INNER JOIN profiles ON profiles.id = users.profile_id
            WHERE cheeps.author_id != $1 AND cheeps.date_created > -1 AND cheeps.date_created < $2
            ORDER BY cheeps.date_created DESC
            LIMIT 20
        `;

        try
        {
            var response = await this.pool.query(query, [ currentUserId, maxTime ]);
        }
        catch(err)
        {
            throw err;
        }

        let result = new Array<CheepData>();

        for(let i = 0; i < response.rowCount; ++i)
        {
            result.push(await this.createCheepData(currentUserId, response.rows[i]));
        }

        return result;
    }

    async getLikedCheeps(currentUserId: number, userHandle: string, maxTime: number): Promise<Array<CheepData>>
    {
        try
        {
            var userDocuments = await this.model.usersModel.find(
                { props: [ { handle: userHandle } ]},
                [ "id" ]
            );
        }
        catch(err)
        {
            throw err;
        }

        if(userDocuments.length === 0)
        {
            return [];
        }

        const userId = userDocuments[0].id;

        const query = `SELECT ${this.cheepDataColumns.join(", ")} FROM likes
            INNER JOIN cheeps ON cheeps.id = likes.cheep_id
            INNER JOIN users ON users.id = cheeps.author_id
            INNER JOIN profiles ON profiles.id = users.profile_id
            WHERE likes.user_id = $1 AND cheeps.date_created > -1 AND cheeps.date_created < $2
            ORDER BY likes.id DESC LIMIT 20;`;

        try
        {
            var response = await this.pool.query(query, [ userId, maxTime ]);
        }
        catch(err)
        {
            throw err;
        }

        let result = new Array<CheepData>();

        for(let i = 0; i < response.rowCount; ++i)
        {
            result.push(await this.createCheepData(currentUserId, response.rows[i]));
        }

        return result;
    }

    async registerNewComment(cheepId: number, client?: PoolClient): Promise<void>
    {
        try
        {
            await this.update(
                {
                    props: [
                        {
                            id: cheepId
                        }
                    ]
                },
                {
                    comments: { expression: "comments + 1" }
                },
                client
            );
        }
        catch(err)
        {
            throw err;
        }
    }

    async unregisterComment(cheepId: number, client?: PoolClient): Promise<void>
    {
        try
        {
            await this.update(
                {
                    props: [
                        {
                            id: cheepId
                        }
                    ]
                },
                {
                    comments: { expression: "comments - 1" }
                },
                client
            );
        }
        catch(err)
        {
            throw err;
        }
    }

    async registerNewRecheep(userId: number, cheepId: number, client?: PoolClient): Promise<boolean>
    {
        try
        {
            var exists = await this.model.recheepsModel.exists(
                {
                    props: [
                        {
                            user_id: userId,
                            cheep_id: cheepId
                        }
                    ]
                },
                client
            );
        }
        catch(err)
        {
            throw err;
        }

        if(exists)
        {
            return false;
        }

        try
        {
            await this.update(
                {
                    props: [
                        {
                            id: cheepId
                        }
                    ]
                },
                {
                    recheeps: { expression: "recheeps + 1" }
                },
                client
            );

            await this.model.recheepsModel.create(
                {
                    user_id: userId,
                    cheep_id: cheepId
                },
                client
            );
        }
        catch(err)
        {
            throw err;
        }

        return true;
    }

    async unregisterRecheep(userId: number, cheepId: number, client?: PoolClient): Promise<void>
    {
        try
        {
            var deleteCount = await this.model.recheepsModel.delete(
                {
                    props: [
                        {
                            user_id: userId,
                            cheep_id: cheepId
                        }
                    ]
                },
                client
            );
        }
        catch(err)
        {
            throw err;
        }

        if(deleteCount === 0)
        {
            return;
        }

        try
        {
            await this.update(
                {
                    props: [
                        {
                            id: cheepId
                        }
                    ]
                },
                {
                    recheeps: { expression: "recheeps - 1" }
                },
                client
            );
        }
        catch(err)
        {
            throw err;
        }
    }

    async registerNewQuote(cheepId: number, client?: PoolClient): Promise<void>
    {
        try
        {
            await this.update(
                {
                    props: [
                        {
                            id: cheepId
                        }
                    ]
                },
                {
                    quotes: { expression: "quotes + 1" }
                },
                client
            );
        }
        catch(err)
        {
            throw err;
        }
    }

    async unregisterQuote(cheepId: number, client?: PoolClient): Promise<void>
    {
        try
        {
            await this.update(
                {
                    props: [
                        {
                            id: cheepId
                        }
                    ]
                },
                {
                    quotes: { expression: "quotes - 1" }
                },
                client
            );
        }
        catch(err)
        {
            throw err;
        }
    }

    async registerNewLike(userId: number, cheepId: number): Promise<void>
    {
        try
        {
            var exists = await this.model.likesModel.exists({
                props: [
                    {
                        user_id: userId,
                        cheep_id: cheepId
                    }
                ]
            });
        }
        catch(err)
        {
            throw err;
        }

        if(exists)
        {
            return;
        }

        try
        {
            await this.update(
                {
                    props: [
                        {
                            id: cheepId
                        }
                    ]
                },
                {
                    likes: { expression: "likes + 1" }
                }
            );

            await this.model.likesModel.create({
                user_id: userId,
                cheep_id: cheepId
            });
        }
        catch(err)
        {
            throw err;
        }
    }

    async deleteLike(userId: number, cheepId: number): Promise<void>
    {
        try
        {
            var deleteCount = await this.model.likesModel.delete({
                props: [
                    {
                        user_id: userId,
                        cheep_id: cheepId
                    }
                ]
            });
        }
        catch(err)
        {
            throw err;
        }

        if(deleteCount > 0)
        {
            try
            {
                await this.update(
                    {
                        props: [
                            {
                                id: cheepId
                            }
                        ]
                    },
                    {
                        likes: { expression: "likes - 1" }
                    }
                );
            }
            catch(err)
            {
                throw err;
            }
        }
    }

    private async checkLike(userId: number, cheepId: number): Promise<boolean>
    {
        try
        {
            return await this.model.likesModel.exists({
                props: [
                    {
                        user_id: userId,
                        cheep_id: cheepId
                    }
                ]
            });
        }
        catch(err)
        {
            throw err;
        }
    }

    private async checkRecheep(userId: number, cheepId: number): Promise<boolean>
    {
        try
        {
            return await this.model.recheepsModel.exists({
                props: [
                    {
                        user_id: userId,
                        cheep_id: cheepId
                    }
                ]
            });
        }
        catch(err)
        {
            throw err;
        }
    }

    private async createCheepData(currentUserId: number, rowData: any): Promise<CheepData>
    {
        if(rowData === undefined)
        {
            return UNDEFINED_CHEEP_DATA;
        }

        let responseOf: CheepData;
        if(rowData.response_target !== null)
        {
            responseOf = await this.getCheep(currentUserId, rowData.response_target);
        }

        let quoteTarget: CheepData;
        if(rowData.quote_target !== null)
        {
            quoteTarget = await this.getCheep(currentUserId, rowData.quote_target);
        }

        try
        {
            var userLikesIt = await this.checkLike(currentUserId, rowData.id);
        }
        catch(err)
        {
            throw err;
        }

        try
        {
            var userRecheeppedIt = await this.checkRecheep(currentUserId, rowData.id);
        }
        catch(err)
        {
            throw err;
        }

        return {
            id: rowData.id,
            author: {
                handle: rowData.handle,
                name: rowData.name,
                picture: rowData.picture,
            },
            dateCreated: Number(rowData.date_created),
            quoteTarget: quoteTarget,
            content: rowData.content,
            gallery: rowData.gallery,
            comments: rowData.comments,
            likes: rowData.likes,
            recheeps: rowData.recheeps,
            quotes: rowData.quotes,
            responseOf: responseOf,
            userLikesIt: userLikesIt,
            userRecheeppedIt: userRecheeppedIt
        };
    }

    private async voidCheep(cheepId: number, authorId: number, client?: PoolClient): Promise<number>
    {
        const pool: Pool | PoolClient = client !== undefined ? client : this.pool;

        const emptyCheep = {
            date_created: -1,
            response_target: null,
            quote_target: null,
            content: null,
            gallery: null,
            comments: 0,
            recheeps: 0,
            quotes: 0,
            likes: 0
        };

        let columns = new Array<string>();
        let values = new Array<any>();

        for(let key in emptyCheep)
        {
            values.push(emptyCheep[key]);
            columns.push(`${key} = $${values.length}`);
        }

        values.push(cheepId);
        let conditions = [ `id = $${values.length}` ];

        values.push(authorId);
        conditions.push(`author_id = $${values.length}`);

        const query = `UPDATE cheeps SET ${columns.join(", ")} WHERE ${conditions.join(" AND ")} RETURNING *`;

        try
        {
            var response = await pool.query(query, values);
        }
        catch(err)
        {
            throw err;
        }

        return response.rowCount;
    }
}

export interface CheepData
{
    id: number;
    author: {
        handle: string;
        name: string;
        picture: string;
    };
    dateCreated: number;
    quoteTarget: CheepData;
    content: string;
    gallery: Array<string>;
    comments: number;
    likes: number;
    recheeps: number;
    quotes: number;
    responseOf?: CheepData;
    userLikesIt: boolean;
    userRecheeppedIt: boolean;
}

const UNDEFINED_CHEEP_DATA: CheepData = {
    id: -1,
    author: {
        handle: "",
        name: "",
        picture: "",
    },
    dateCreated: 0,
    quoteTarget: undefined,
    content: "",
    gallery: [],
    comments: 0,
    likes: 0,
    recheeps: 0,
    quotes: 0,
    userLikesIt: false,
    userRecheeppedIt: false
};

export interface SearchCheepsParameters
{
    words: Array<string>;
    maxTime: number;
    responses: boolean;
    onlyGallery: boolean;
    responseOf: number;
    userHandle?: string;
    quoteTarget?: number;
    recheepTarget?: number;
}

export default CheepsModel;
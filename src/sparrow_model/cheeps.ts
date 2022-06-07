import { Pool } from "pg";
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

    async cheep(data: CheepsDocument): Promise<CheepsDocument>
    {
        try
        {
            var cheepDocument = await this.create(data);
            await this.model.profilesModel.registerNewCheep(data.author_id, this.model.usersModel);
        }
        catch(err)
        {
            throw err;
        }

        if(cheepDocument.response_target !== null)
        {
            this.registerNewComment(cheepDocument.response_target);
        }

        if(cheepDocument.quote_target !== null)
        {
            if(cheepDocument.content === null)
            {
                this.registerNewRecheep(data.author_id, cheepDocument.quote_target);
            }
            else
            {
                this.registerNewQuote(cheepDocument.quote_target);
            }
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
                        id: cheepId
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

        if(cheepDocument.quote_target)
        {
            try
            {
                if(cheepDocument.content)
                {
                    await this.unregisterQuote(cheepDocument.quote_target);
                }
                else
                {
                    await this.unregisterRecheep(cheepDocument.author_id, cheepDocument.quote_target);
                }
            }
            catch(err)
            {
                throw err;
            }
        }

        if(cheepDocument.response_target)
        {
            try
            {
                await this.unregisterComment(cheepDocument.response_target);
            }
            catch(err)
            {
                throw err;
            }
        }

        try
        {
            var deleteCount = await this.delete({
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

        return deleteCount > 0;
    }

    async searchCheeps(currentUserId: number, parameters: SearchCheepsParameters): Promise<Array<CheepData>>
    {
        let values: Array<any> = [];

        let whereConditions = new Array<string>();
        if(parameters.words.length > 0)
        {
            whereConditions.push(parameters.words.map((word) =>
            {
                return `cheeps.content LIKE '%${word}%'`;
            }).join(" AND "));
        }

        whereConditions.push(`cheeps.date_created < $${values.length + 1}`);
        values.push(parameters.maxTime);

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

        let query = `SELECT ${this.cheepDataColumns.join(", ")} FROM cheeps
            INNER JOIN users ON users.id = cheeps.author_id
            INNER JOIN profiles ON profiles.id = users.profile_id
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
            WHERE follows.user_id = $1 AND cheeps.date_created < $2
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
            WHERE likes.user_id = $1 AND cheeps.date_created < $2
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

    async registerNewComment(cheepId: number): Promise<void>
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
                }
            );
        }
        catch(err)
        {
            throw err;
        }
    }

    async unregisterComment(cheepId: number): Promise<void>
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
                }
            );
        }
        catch(err)
        {
            throw err;
        }
    }

    async registerNewRecheep(userId: number, cheepId: number): Promise<void>
    {
        try
        {
            var exists = await this.model.recheepsModel.exists({
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
                    recheeps: { expression: "recheeps + 1" }
                }
            );
        }
        catch(err)
        {
            throw err;
        }
    }

    async unregisterRecheep(userId: number, cheepId: number): Promise<void>
    {
        try
        {
            var deleteCount = await this.model.recheepsModel.delete({
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
                    recheeps: { expression: "recheeps . 1" }
                }
            );
        }
        catch(err)
        {
            throw err;
        }
    }

    async registerNewQuote(cheepId: number): Promise<void>
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
                }
            );
        }
        catch(err)
        {
            throw err;
        }
    }

    async unregisterQuote(cheepId: number): Promise<void>
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
                }
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
        let responseOf: CheepData;
        if(rowData.response_target !== null)
        {
            responseOf = await this.getCheep(currentUserId, rowData.response_target);
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
            quoteTarget: rowData.quote_target,
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
    quoteTarget: number;
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

export interface SearchCheepsParameters
{
    words: Array<string>;
    maxTime: number;
    responses: boolean;
    onlyGallery: boolean;
    responseOf: number;
    userHandle?: string;
}

export default CheepsModel;
import { Pool } from "pg";
import BasicDocument from "../model/basic_document";
import BasicModel from "../model/basic_model";
import Schema from "../model/schema/schema";
import LikesModel from "./likes";
import ProfilesModel from "./profiles";
import RecheepsModel from "./recheeps";
import UsersModel from "./users";

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

    constructor(pool: Pool)
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
    }

    async cheep(data: CheepsDocument, usersModel: UsersModel, profilesModel: ProfilesModel, recheepsModel: RecheepsModel): Promise<CheepsDocument>
    {
        try
        {
            var cheepDocument = await this.create(data);
            await profilesModel.registerNewCheep(data.author_id, usersModel);
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
                this.registerNewRecheep(data.author_id, cheepDocument.quote_target, recheepsModel);
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

    async searchCheeps(words: Array<string>, maxTime: number, responses: boolean, onlyGallery: boolean, userHandle?: string): Promise<Array<CheepData>>
    {
        let values: Array<any> = [ maxTime ];

        let whereConditions = new Array<string>();
        if(words.length > 0)
        {
            whereConditions.push(words.map((word) =>
            {
                return `cheeps.content LIKE '%${word}%'`;
            }).join(" AND "));
        }

        whereConditions.push(`cheeps.date_created < $1`);

        if(!responses)
        {
            whereConditions.push(`cheeps.response_target IS NULL`);
        }

        if(onlyGallery)
        {
            whereConditions.push(`cheeps.gallery IS NOT NULL`);
        }

        if(userHandle !== undefined)
        {
            whereConditions.push(`users.handle = $2`);
            values.push(userHandle);
        }

        let query = `SELECT ${this.cheepDataColumns.join(", ")} FROM cheeps
            INNER JOIN users ON users.id = cheeps.author_id
            INNER JOIN profiles ON profiles.id = users.profile_id
            WHERE ${whereConditions.join(" AND ")}
            ORDER BY users.date_created DESC LIMIT 20;`;

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
            result.push(await this.createCheepData(response.rows[i]));
        }

        return result;
    }

    async getCheep(cheepId: number): Promise<CheepData>
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

        return this.createCheepData(response.rows[0]);
    }

    async getTimeline(userId: number, maxTime: number): Promise<Array<CheepData>>
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
            result.push(await this.createCheepData(response.rows[i]));
        }

        return result;
    }

    async getLikedCheeps(userHandle: string, maxTime: number, usersModel: UsersModel): Promise<Array<CheepData>>
    {
        try
        {
            var userDocuments = await usersModel.find(
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
            result.push(await this.createCheepData(response.rows[i]));
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

    async registerNewRecheep(userId: number, cheepId: number, recheepsModel: RecheepsModel): Promise<void>
    {
        try
        {
            var exists = await recheepsModel.exists({
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

    async registerNewLike(userId: number, cheepId: number, likesModel: LikesModel): Promise<void>
    {
        try
        {
            var exists = await likesModel.exists({
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

            await likesModel.create({
                user_id: userId,
                cheep_id: cheepId
            });
        }
        catch(err)
        {
            throw err;
        }
    }

    private async createCheepData(rowData: any): Promise<CheepData>
    {
        let responseOf: CheepData;
        if(rowData.response_target !== null)
        {
            responseOf = await this.getCheep(rowData.response_target);
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
            responseOf: responseOf
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
}

export default CheepsModel;
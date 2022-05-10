import { Pool } from "pg";
import BasicDocument from "../model/basic_document";
import BasicModel from "../model/basic_model";
import Schema from "../model/schema/schema";
import ProfilesModel from "./profiles";
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
    likes: {
        type: "int",
        notNull: true,
        default: 0
    }
});

class CheepsModel extends BasicModel<CheepsDocument>
{
    constructor(pool: Pool)
    {
        super(cheepsSchema, pool);
    }

    async cheep(data: CheepsDocument, usersModel: UsersModel, profilesModel: ProfilesModel): Promise<CheepsDocument>
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
            this.registerNewRecheep(cheepDocument.quote_target);
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

    async getCheep(cheepId: number): Promise<CheepData>
    {
        let table = this.getTableName();
        let cheepColumns = this.columnList.map(column => `${table}.${column}`);
        let userColumns = [ "users.handle" ];
        let profileColumns = [ "profiles.name", "profiles.picture" ];
        let columns = [ ...cheepColumns, ...userColumns, ...profileColumns ];

        let query = `SELECT ${columns.join(", ")} FROM cheeps
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
        
        let responseOf: CheepData;
        if(response.rows[0].response_target !== null)
        {
            responseOf = await this.getCheep(response.rows[0].response_target);
        }

        return {
            id: response.rows[0].id,
            author: {
                handle: response.rows[0].handle,
                name: response.rows[0].name,
                picture: response.rows[0].picture,
            },
            dateCreated: response.rows[0].date_created,
            quoteTarget: response.rows[0].quote_target,
            content: response.rows[0].content,
            gallery: response.rows[0].gallery,
            comments: response.rows[0].comments,
            likes: response.rows[0].likes,
            recheeps: response.rows[0].recheeps,
            responseOf: responseOf
        };
    }

    async getTimeline(userId: number, maxTime: number): Promise<Array<CheepData>>
    {
        let table = this.getTableName();
        let cheepColumns = this.columnList.map(column => `${table}.${column}`);
        let userColumns = [ "users.handle" ];
        let profileColumns = [ "profiles.name", "profiles.picture" ];

        let columns = [ ...cheepColumns, ...userColumns, ...profileColumns ];

        const query = `SELECT ${columns.join(", ")} FROM follows
            INNER JOIN cheeps ON cheeps.author_id = follows.target_id
            INNER JOIN users ON users.id = follows.target_id
            INNER JOIN profiles ON profiles.user_id = follows.target_id
            WHERE follows.user_id = $1 AND cheeps.date_created < $2
            ORDER BY cheeps.date_created LIMIT 20;`;

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
            let responseOf: CheepData;
            if(response.rows[i].response_target !== null)
            {
                responseOf = await this.getCheep(response.rows[i].response_target);
            }

            result.push({
                id: response.rows[i].id,
                author: {
                    handle: response.rows[i].handle,
                    name: response.rows[i].name,
                    picture: response.rows[i].picture,
                },
                dateCreated: response.rows[i].date_created,
                quoteTarget: response.rows[i].quote_target,
                content: response.rows[i].content,
                gallery: response.rows[i].gallery,
                comments: response.rows[i].comments,
                likes: response.rows[i].likes,
                recheeps: response.rows[i].recheeps,
                responseOf: responseOf
            });
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

    async registerNewRecheep(cheepId: number): Promise<void>
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
                    recheeps: { expression: "recheeps + 1" }
                }
            );
        }
        catch(err)
        {
            throw err;
        }
    }

    async registerNewLike(cheepId: number): Promise<void>
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
                    likes: { expression: "likes + 1" }
                }
            );
        }
        catch(err)
        {
            throw err;
        }
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
    responseOf?: CheepData;
}

export default CheepsModel;
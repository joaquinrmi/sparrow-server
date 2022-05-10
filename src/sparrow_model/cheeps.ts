import { Pool } from "pg";
import BasicDocument from "../model/basic_document";
import BasicModel from "../model/basic_model";
import Schema from "../model/schema/schema";
import FollowsModel from "./follows";
import ProfilesModel from "./profiles";
import UsersModel, { UsersDocument } from "./users";

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

        return cheepDocument;
    }

    async getCheep(cheepId: number): Promise<CheepsDocument>
    {
        try
        {
            var documents = await this.find({
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

        if(documents.length === 0)
        {
            return null;
        }

        return documents[0];
    }

    async getTimeline(userId: number, maxTime: number): Promise<Array<CheepData>>
    {
        let table = this.getTableName();
        let cheepColumns = this.columnList.map(column => `${table}.${column}`);
        let userColumns = [ "users.handle" ];
        let profileColumns = [ "profiles.name", "profiles.picture" ];

        let columns = [ ...cheepColumns, ...userColumns, ...profileColumns ];

        const query = `SELECT ${columns.join(", ")} FROM follows
            INNER JOIN cheeps ON cheeps.author = follows.target_id
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
            result.push({
                id: response.rows[i].id,
                author: {
                    handle: response.rows[i].handle,
                    name: response.rows[i].name,
                    picture: response.rows[i].picture,
                },
                dateCreated: response.rows[i].date_created,
                responseTarget: response.rows[i].response_target,
                quoteTarget: response.rows[i].quote_target,
                content: response.rows[i].content,
                gallery: response.rows[i].gallery,
                comments: response.rows[i].comments,
                likes: response.rows[i].likes,
                recheeps: response.rows[i].recheeps
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
    responseTarget: number;
    quoteTarget: number;
    content: string;
    gallery: Array<string>;
    comments: number;
    likes: number;
    recheeps: number;
}

export default CheepsModel;
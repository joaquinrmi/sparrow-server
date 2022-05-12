import { Pool } from "pg";
import BasicDocument from "../model/basic_document";
import BasicModel from "../model/basic_model";
import Schema from "../model/schema/schema";

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
}

export default FollowsModel;
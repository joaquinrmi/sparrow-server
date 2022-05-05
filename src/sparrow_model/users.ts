import BasicDocument from "../model/basic_document";
import BasicModel from "../model/basic_model";
import Schema from "../model/schema/schema";

interface UsersDocument extends BasicDocument
{
    id: number;
    handle: string;
    email: string;
    password: string;
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
    }
});

export class UsersModel extends BasicModel<UsersDocument>
{
    constructor(schema: Schema<UsersDocument>)
    {
        super(schema);
    }
}

export default new UsersModel(usersSchema);
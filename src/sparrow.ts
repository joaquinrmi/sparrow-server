import path from "path";
import express, { Request, Response } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import multer from "multer";
import SparrowModel from "./sparrow_model/";
import UsersRouter from "./routes/users/";

dotenv.config();

class Sparrow
{
    private app: express.Application;
    private model: SparrowModel;
    private upload: multer.Multer;

    private usersRouter: UsersRouter;

    constructor()
    {
        this.app = express();
        this.model = new SparrowModel();

        const storage = multer.memoryStorage();
        this.upload = multer({ storage });

        this.usersRouter = new UsersRouter();
    }

    async start()
    {
        try
        {
            await this.model.initialize();
        }
        catch(err)
        {
            throw err;
        }

        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: false }));
        this.app.use(cookieParser());
        this.app.use(session({
            secret: process.env.SESSION_SECRET,
            resave: false,
            saveUninitialized: false
        }));

        this.app.use(express.static(path.join(__dirname, "..", "res")));

        this.app.use("/api/user", this.usersRouter.use());

        this.app.get("*", (req : Request, res : Response) => {
            res.sendFile(path.join(__dirname, "..", "res", "index.html"));
        });

        this.app.listen(process.env.PORT, () =>
        {
            console.log(`Server on port ${process.env.PORT}.`);
        });
    }
}

export default Sparrow;
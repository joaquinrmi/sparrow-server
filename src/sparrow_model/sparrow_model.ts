import { Pool } from "pg";
import ProfilesModel from "./profiles";
import UsersModel from "./users";
import CheepsModel from "./cheeps";
import FollowsModel from "./follows";
import LikesModel from "./likes";

class SparrowModel
{
    profilesModel: ProfilesModel;
    usersModel: UsersModel;
    cheepsModel: CheepsModel;
    followsModel: FollowsModel;
    likesModel: LikesModel;
    
    private pool: Pool;

    constructor()
    {
        this.pool = new Pool();

        this.profilesModel = new ProfilesModel(this.pool);
        this.usersModel = new UsersModel(this.pool);
        this.cheepsModel = new CheepsModel(this.pool);
        this.followsModel = new FollowsModel(this.pool);
        this.likesModel = new LikesModel(this.pool);
    }

    async initialize()
    {
        try
        {
            await this.profilesModel.initialize();
            await this.usersModel.initialize();
            await this.cheepsModel.initialize();
            await this.followsModel.initialize();
            await this.likesModel.initialize();
        }
        catch(err)
        {
            console.log(err);
        }
    }
}

export default SparrowModel;
import UserShortInfo from "./user_short_info";

interface UserCellInfo extends UserShortInfo
{
    id: number;
    following: boolean;
    follower: boolean;
}

export default UserCellInfo;
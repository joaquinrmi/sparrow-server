enum ErrorType
{
    InternalServerError = "Internal Server Error",
    InvalidQuery = "Invalid Query",
    InvalidForm = "Invalid Form",
    HandleAlreadyExists = "Username Already Exists",
    EmailAlreadyExists = "Email Already Exists",
    ProfileNotFound = "Profile Not Found",
    IncorrectUsernameOrPassword = "Incorrect Username Or Password",
    SessionDoesNotExist = "Session Does Not Exist",
    InvalidCheepContent = "Invalid Cheep Content",
    CheepDoesNotExist = "Cheep does not exist"
}

export default ErrorType;
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
    CheepDoesNotExist = "Cheep Does Not Exist",
    CannotDeleteCheep = "Cannot Delete Cheep"
}

export default ErrorType;
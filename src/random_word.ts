const CHARS = "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789";

function randomWord(length: number): string
{
    let word = "";
    for(let i = 0; i < length; ++i)
    {
        word += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }

    return word;
}

export default randomWord;
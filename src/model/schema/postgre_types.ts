interface PostgreType
{
    smallserial: number;
    serial: number;
    bigserial: number;
    smallint: number;
    integer: number;
    int: number;
    bigint: number;
    decimal: number;
    numeric: number;
    real: number;
    "double precision": number;
    varchar: string;
    text: string;
    date: Date;
    timestamp: Date;
}

export const DefaultValues: PostgreType =
{
    smallserial: 0,
    serial: 0,
    bigserial: 0,
    smallint: 0,
    integer: 0,
    int: 0,
    bigint: 0,
    decimal: 0,
    numeric: 0,
    real: 0,
    "double precision": 0,
    varchar: "",
    text: "",
    date: new Date(),
    timestamp: new Date(),
};

export class NumericType
{
    precision: number;
    scale: number;

    constructor(precision: number, scale: number = 0)
    {
        this.precision = precision;
        this.scale = scale;
    }
}

export class VarcharType
{
    length: number;

    constructor(length: number)
    {
        this.length = length;
    }
}

export default PostgreType;
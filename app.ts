import { Cache } from "./cache.ts";
import { Cuitter } from "./cuitter.ts";
import { Twitter } from './twitter.ts'

// deno run --unstable --allow-net --allow-env --allow-write app.ts

const args = ( ( args ) =>
{
    const options: { option: string, message: string, other?: string[] }[] =
    [
        { option: 'help', message: 'Prints help information.', other: [ 'h' ] },
        { option: 'once', message: 'Prints timeline (JSON).', },
        { option: 'apiKey', message: 'Twitter API key.', },
        { option: 'apiKeySecret', message: 'Twitter API key Secret', },
        { option: 'accessToken', message: 'Twitter user access token.', },
        { option: 'accessTokenSecret', message: 'Twitter user access token secret.', },
        { option: 'logo', message: 'Prints logo.' },
        { option: 'version', message: 'Prints version information.', other: [ 'v' ] },
    ];
    const env: { [ keys: string ]: { env: string, args: string[] } } =
    {
        apiKey: { env: 'CUITTER_API_KEY', args: [ '--api_key' ] },
        apiKeySecret: { env: 'CUITTER_API_KEY_SECRET', args: [ '--api_key_secret' ] },
        accessToken: { env: 'CUITTER_ACCESS_TOKEN', args: [ '--access_token' ] },
        accessTokenSecret: { env: 'CUITTER_ACCESS_TOKEN_SECRET', args: [ '--access_token_secret' ] },
    };
    const argkey: { [ keys: string ]: string } = {};
    const data =
    {
        once: false,
        apiKey: '',
        apiKeySecret: '',
        accessToken: '',
        accessTokenSecret: '',
    };

    const help = () =>
    {
        console.log( Cuitter.logo() );

        console.log();
        console.log( 'Cui twitter' );

        console.log();
        console.log( 'USAGE:' );
        console.log( './cuitter [OPTIONS]' );
        console.log( 'deno run --unstable --allow-net --allow-env --allow-write app.ts [OPTIONS]' );

        console.log();
        console.log( 'OPTIONS:' );
        options.forEach( ( option ) =>
        {
            const options = ( option.other ? option.other : [] ).map( ( o ) => { return '--' + o; } );
            options.push( '--' + option.option );

            console.log( `    ${ options.join( ', ' ) }` );
            console.log( `        ${ option.message }` );
            if ( env[ option.option ] )
            {
                console.log( '        You can set environment variable.' );
                console.log( `        ${ env[ option.option ].env }` );
            }

            console.log();
        } );

        console.log( 'ENVIRONMENT VARIABLES:' );
        options.forEach( ( option ) =>
        {
            if ( !env[ option.option ] ) { return; }
            console.log( `    ${ env[ option.option ].env }` );
            console.log( `        ${ option.message }` );
        } );

        Deno.exit( 0 );
    };

    const print = ( message: string ) =>
    {
        console.log( message );

        Deno.exit( 0 );
    };

    Object.keys( env ).forEach( ( key ) =>
    {
        env[ key ].args.forEach( ( arg ) => { argkey[ arg ] = key; } );
        const value = Deno.env.get( env[ key ].env );
        if ( !value ) { return; }
        (<any>data)[ key ] = value;
    } );

    for ( let i = 0 ; i < args.length ; ++i )
    {
        const key = argkey[ args[ i ] ];
        if ( key )
        {
            if ( args[ i + 1 ] && !args[ i + 1 ].match( /^\-/ ) )
            {
                (<any>data)[ key ] = args[ ++i ];
                continue;
            }
        }

        switch ( args[ i ] )
        {
            case '--once': data.once = true; break;
            case '--h':
            case '--help': help();
            case '--logo': print( Cuitter.logo( false ) );
            case '--v':
            case '--version': print( `cuitter ${ Cuitter.version }` );
        }
    }

    return data;
} )( Deno.args );

( ( errors ) =>
{
    if ( errors.length <= 0 ) { return; }
    console.error( errors.join( '\n' ) );
    Deno.exit( 1 );
} )(( () =>
{
    const list: string[] = [];
    if ( !args.apiKey ) { list.push( 'No set api_key.' ); }
    if ( !args.apiKeySecret ) { list.push( 'No set api_key_secret.' ); }
    if ( !args.accessToken ) { list.push( 'No set access_token.' ); }
    if ( !args.accessTokenSecret ) { list.push( 'No set access_token_secret.' ); }
    return list;
} )() );

const cache = new Cache( '.cache' );
await cache.prepare();

const twitter = new Twitter( args.apiKey, args.apiKeySecret, args.accessToken, args.accessTokenSecret, cache );

if ( args.once )
{
    const data = await twitter.v11.statuses.home_timeline( {} ).catch( ( error ) => { return error; } );

    console.log( JSON.stringify( data ) );

    Deno.exit( 0 );
}

const cuitter = new Cuitter( twitter, cache );

await cuitter.start().catch( ( error ) =>
{
    console.error( error );

    Deno.exit( 1 );
} );

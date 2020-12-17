import { Tweet } from "./twitter_types.ts";
import * as path from "https://deno.land/std/path/mod.ts";

interface TWITTER_LOG
{
    [ keys: string ]: TWITTER_LOG | number[];
}

export interface TwitterTimelineCache
{
    saveTweets( tweets: Tweet[] ): Promise<void>;
    loadTweets(): Promise<Tweet[]>;
}

export interface TwitterApiLogs
{
    saveTwitterApiLogs( data: TWITTER_LOG ): Promise<void>;
    loadTwitterApiLogs(): Promise<TWITTER_LOG>;
}

export class Cache implements TwitterTimelineCache, TwitterApiLogs
{
    private dir!: string;

    constructor( dir: string )
    {
        this.dir = dir;
    }

    public prepare()
    {
        return Deno.mkdir( this.dir ).catch( ( error ) =>
        {
            if ( error && error.name === 'AlreadyExists' ) { return; }
        } );
    }

    public saveTweets( tweets: Tweet[] )
    {
        return Deno.writeTextFile(
            path.join( this.dir, 'timeline.json' ),
            JSON.stringify( tweets )
        );
    }

    public loadTweets(): Promise<Tweet[]>
    {
        return Deno.readTextFile( path.join( this.dir, 'timeline.json' ) ).then( ( text ) =>
        {
            return JSON.parse( text );
        } ).catch( ( error ) =>
        {
            return [];
        } );
    }

    public saveTwitterApiLogs( data: TWITTER_LOG )
    {
        return Deno.writeTextFile(
            path.join( this.dir, 'logs.json' ),
            JSON.stringify( data )
        );
    }

    public loadTwitterApiLogs(): Promise<TWITTER_LOG>
    {
        return Deno.readTextFile( path.join( this.dir, 'logs.json' ) ).then( ( text ) =>
        {
            return <TWITTER_LOG>JSON.parse( text );
        } ).catch( ( error ) =>
        {
            return {};
        } );
    }
}

import { TwitterApiLogs } from './cache.ts'
import { OauthFetch } from './oauth_fetch.ts'
import * as TwitterTypes from './twitter_types.ts';

class TwitterApi
{
    protected parent!: TwitterApi;
    protected path: string = '';
    protected getPath(): string { return this.parent.getPath() + this.path; }
    protected get fetch(): OauthFetch { return this.parent.fetch; }
    protected save(): Promise<void> { return this.parent.save(); }

    constructor( parent: TwitterApi )
    {
        this.parent = parent;
        this.onSetParent();
    }

    protected onSetParent(){}

    protected createUrl( name: string )
    {
        return this.getPath() + name + '.json';
    }
}

export class Twitter extends TwitterApi
{
    protected logs: TwitterApiLogs =
    {
        saveTwitterApiLogs: ( data: any ) => { return Promise.resolve(); },
        loadTwitterApiLogs: () => { return Promise.resolve( <any>{} ); },
    };

    protected save(): Promise<void>
    {
        return this.logs.saveTwitterApiLogs( this.export() ).catch( ( error ) => {} );
    }

    protected path = 'https://api.twitter.com/';

    protected getPath() { return this.path; }

    public v11 = new V11( this );

    protected get fetch() { return this.f; }

    private f!: OauthFetch;

    constructor( apiKey: string, apiKeySecret: string, accessToken: string, accessTokenSecret: string, logs?: TwitterApiLogs )
    {
        super( <any>null );
        this.f = new OauthFetch( apiKey, apiKeySecret, accessToken, accessTokenSecret );
        if ( logs ) { this.logs = logs; }
    }

    public export()
    {
        return {
            v11: this.v11.export(),
        };
    }

    public import( data: any )
    {
        if ( typeof data !== 'object' ) { return; }
        if ( typeof data.v11 === 'object' ) { this.v11.import( data.v11 ); }
    }
}

class V11 extends TwitterApi
{
    protected path = '1.1/';

    public statuses = new Statuses( this );

    public export()
    {
        return {
            statuses: this.statuses.export(),
        };
    }

    public import( data: any )
    {
        if ( typeof data !== 'object' ) { return; }
        if ( typeof data.statuses === 'object' ) { this.statuses.import( data.statuses ); }
    }
}

class ApiCounter extends TwitterApi
{
    protected limits: { [ keys: string ]: { count: number, time: number } } = {};
    private logs: { [ keys: string ]: number[] } = {};

    protected isLimit( api: string )
    {
        const limit = this.limits[ api ];
        if ( !limit ) { return false; }

        const now = Date.now() - limit.time * 60000;
        const log = ( this.logs[ api ] || [] ).filter( ( time ) => { return now <= time; } );
        this.logs[ api ] = log;

        return limit.count <= log.length;
    }

    protected addSuccessRequest( api: string )
    {
        if ( !this.limits[ api ] ) { return false; }
        this.logs[ api ] = ( this.logs[ api ] || [] );
        this.logs[ api ].push( Date.now() );
    }

    protected limitError()
    {
        return Promise.reject( new Error( 'API limit.' ) );
    }

    public export()
    {
        return this.logs;
    }

    public import( data: any )
    {
        if ( typeof data !== 'object' ) { return; }
        Object.keys( data ).forEach( ( key ) =>
        {
            const log = data[ key ];
            if ( !Array.isArray( log ) ) { return; }
            this.logs[ key ] = log.filter( ( d ) => { return typeof d === 'number'; } );
        } );
    }
}

export interface Status_HomeTimeline
{
    count?: number, // Default 20, Max 200
    since_id?: number, //
    max_id?: number, //
    trim_user?: boolean, //
    exclude_replies?: boolean, //
    include_entities?: boolean, //
}

class Statuses extends ApiCounter
{
    protected path = 'statuses/';

    protected limits =
    {
        home_timeline: { count: 15, time: 15 },
    };

    public home_timeline( option: Status_HomeTimeline ): Promise<TwitterTypes.Tweet[]>
    {
        const api = 'home_timeline';
        if ( this.isLimit( api ) ) { return this.limitError(); }

        return this.fetch.get( this.createUrl( api ), <{}>option ).then( ( response ) =>
        {
            this.addSuccessRequest( api );
            return response.json();
        } ).then( async ( result ) =>
        {
            if ( result.errors )
            {
                throw new Error( `Error: ${ JSON.stringify( result ) }` );
            }

            await this.save();

            return result;
        } );
    }
}

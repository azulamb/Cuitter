import { Tweet } from './twitter_types.ts'
import { Twitter, Status_HomeTimeline } from "./twitter.ts";
import { TwitterTimelineCache } from "./cache.ts";

export class Timeline
{
    private twitter!: Twitter;
    private cache?: TwitterTimelineCache;
    private defaultOption: {
        count?: number,
        since_id?: number,
        max_id?: number,
        trim_user?: boolean,
        exclude_replies?: boolean,
        include_entities?: boolean,
    } = {};
    private max = 1000;
    private tweets: Tweet[] = [];
    private ids: { [ keys: string ]: Date } = {};
    private updatedAt!: Date;

    constructor( twitter?: Twitter )
    {
        if ( twitter ) { this.twitter = twitter; }
        this.updatedAt = new Date();
    }

    public setTwitter( twitter: Twitter )
    {
        this.twitter = twitter;

        return this;
    }

    public setOption( option: Status_HomeTimeline )
    {
        if ( option.count && 0 < option.count )
        {
            this.defaultOption.count = Math.min( 200, option.count );
        }

        return this;
    }

    public setCache( cache: TwitterTimelineCache )
    {
        this.cache = cache;
        return this;
    }

    public setMax( max: number )
    {
        if ( 0 < max ) { this.max = max; }

        return this;
    }

    public setUnlimited()
    {
        this.max = 0;

        return this;
    }

    public get lastUpdate() { return this.updatedAt; }

    public add( tweets: Tweet[] )
    {
        const existIds: string[] = [];
        const removeTweets: Tweet[] = [];

        tweets.forEach( ( tweet ) =>
        {
            if ( this.ids[ tweet.id_str ] ) { existIds.push( tweet.id_str ); return; }
            this.tweets.unshift( tweet );
            this.ids[ tweet.id_str ] = new Date( tweet.created_at );
        } );

        if ( 0 < this.max )
        {
            while ( this.max < this.tweets.length )
            {
                const tweet = <Tweet>this.tweets.pop();
                delete this.ids[ tweet.id_str ];
                removeTweets.push( tweet );
            }
        }

        return {
            existIds: existIds,
            removeTweets: removeTweets,
        };
    }

    public update()
    {
        if ( !this.twitter ) { return Promise.reject( new Error( 'No set Twitter.' ) ); }

        return this.twitter.v11.statuses.home_timeline( this.defaultOption ).then( ( tweets ) =>
        {
            this.updatedAt = new Date();

            const result = this.add( tweets );
            const data: {
                add: Tweet[],
                exists: Tweet[],
                remove: Tweet[],
            } =
            {
                add: [],
                exists: [],
                remove: result.removeTweets,
            };

            tweets.forEach( ( tweet ) =>
            {
                if ( result.existIds.indexOf( tweet.id_str ) < 0 )
                {
                    data.add.push( tweet );
                } else
                {
                    data.exists.push( tweet );
                }
            } );

            return data;
        } ).finally( () =>
        {
            if ( !this.cache ) { return; }
            return this.cache.saveTweets( this.tweets ).catch( () =>
            {
                this.cache = undefined;
            } );
        } );
    }

    public read( size: number, offset = 0 ) { return this.tweets.slice( offset, offset + size ); }

    public get size() { return this.tweets.length; }

    public all() { return this.tweets; }
}

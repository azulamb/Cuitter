import { Timeline } from "./timeline.ts";
import { Box, Tui, StringEx } from 'https://github.com/Azulamb/tui/raw/main/tui.ts'
import { Twitter } from "./twitter.ts";
import { Tweet } from "./twitter_types.ts";
import { Cache } from "./cache.ts";

export interface Drawer
{
    draw: ( box: Box ) => void;
    create: ( x: number, y: number, width: number, height: number, data: string ) => Box;
}

export class Cuitter implements Drawer
{
    static get version() { return '0.0.1'; }
    static logo( version: boolean = true )
    {
        return `▄▀▀▀   ▀ ▄█▄▄█▄ ▄▀▀▄ █▄▄
█  █ █ █  █  █  █▀▀▀ █
▀▄▄▄▀▀ ▀   ▀  ▀  ▀▀  ▀${ version ? ' v' + this.version : '' }`;
    }

    private twitter!: Twitter;
    private timeline!: Timeline;
    private tui!: Tui;
    private nowUpdate: Promise<void> | null = null;
    private timer: number = 0;

    private views!:
    {
        timeline: TimelineView,
        status: StatusView,
    };

    public draw( box: Box ) { this.tui.drawBox( box ); }
    public create( x: number, y: number, width: number, height: number, data: string )
    {
        const box = this.tui.createBox( data );
        box.x = x;
        box.y = y;
        box.width = width;
        box.height = height;
        return box;
    }

    constructor( twitter: Twitter, cache?: Cache )
    {
        this.tui = new Tui();
        this.views =
        {
            timeline: new TimelineView( this ),
            status: new StatusView( this ),
        };
        this.twitter = twitter;
        this.timeline = new Timeline( twitter ).setOption( { count: 200 } );
        if ( cache ) { this.timeline.setCache( cache ); }
    }

    public async start()
    {
        this.tui.enableMouse( true );
        this.tui.onResize = () => { this.onResize(); };
        this.tui.onInput = ( buffer ) => { this.onInput( buffer ); };
        this.tui.onWheel = ( event ) => { this.move( event.wheel ); };

        this.tui.terminal.showCursor( false );
        return this.tui.start( () =>
        {
            this.clear();
            console.log( Cuitter.logo() );
            this.setView();
            this.update( 3000 );
            this.timer = setInterval( () => { this.update(); }, 60000 );
        } ).finally( async () =>
        {
            clearInterval( this.timer );
            this.tui.terminal.showCursor( true );
            if ( this.nowUpdate ) { await this.nowUpdate; }
        } );
    }

    private clear()
    {
        this.tui.terminal.clear();
        this.tui.terminal.move();
    }

    private update( time: number = 0 )
    {
        if ( this.nowUpdate ) { return; }
        this.nowUpdate = this.onUpdate( time ).catch( ( error ) =>
        {
            if ( !error ) { return; }
            this.views.status.error( error.message || JSON.stringify( error ) );
        } ).finally( () =>
        {
            this.nowUpdate = null;
        } );
    }

    private async onUpdate( time: number )
    {
        if ( 0 < time )
        {
            await new Promise( ( resolve ) => { setTimeout( resolve, time ); } );
        }

        await this.timeline.update();

        this.views.status.setLastUpdate( this.timeline.lastUpdate );
        this.views.timeline.setTweets( this.timeline.all() );

        this.render();
    }

    private setView()
    {
        const width = this.tui.terminal.width;
        const height = this.tui.terminal.height - 1;

        this.views.timeline.onResize( 1, 2, width, height - 1 );
        this.views.status.onResize( 1, height, width, 1 );
    }

    private onResize()
    {
        this.setView();
        this.render();
    }

    private onInput( buffer: Uint8Array )
    {
        const key = this.bufferToKey( buffer );
        //this.views.status.error( key );
        //this.render();
        switch ( key )
        {
            case 'up': return this.move( -1 );
            case 'down': return this.move( 1 );
            case 'r': this.update(); break;
        }
    }

    private bufferToKey( buffer: Uint8Array )
    {
        if ( buffer.length === 3 && buffer[ 0 ] === 27 && buffer[ 1 ] === 91 )
        {
            switch ( buffer[ 2 ] )
            {
                case 65: return 'up';
                case 66: return 'down';
                case 67: return 'right';
                case 68: return 'left';
            }
        }

        if ( buffer.length === 1 )
        {
            if ( 32 <= buffer[ 0 ] && buffer[ 0 ] <= 126 ) { return String.fromCharCode( buffer[ 0 ] ); }
            switch ( buffer[ 0 ] )
            {
                case 9: return 'tab';
                case 13: return 'enter';
                case 127: return 'back';
            }
        }

        return '';
    }

    private render()
    {
        this.clear();
        this.views.timeline.render();
        this.views.status.render();
    }

    private move( move: -1 | 1 )
    {
        const result = move < 0 ? this.views.timeline.up() : this.views.timeline.down();
        this.render();
    }

}

class View
{
    protected x: number = 0;
    protected y: number = 0;
    protected width: number = 0;
    protected height: number = 0;
    private d!: Drawer;

    constructor( drawer: Drawer )
    {
        this.d = drawer;
    }

    public draw( x: number, y: number, data: string )
    {
        const _x = this.x + x;
        const line = this.d.create( _x, this.y + y, this.width - _x, 1, data );
        this.d.draw( line );
    }

    public onResize( x: number, y: number, widtth: number, height: number )
    {
        this.x = x;
        this.y = y;
        this.width = widtth;
        this.height = height;

        return this;
    }

    public render(){}
}

class TimelineView extends View
{
    private offset = 0;
    private cursor = 0;
    private timeline: Tweet[] = [];

    private drawCursor( x: number, y: number )
    {
        this.draw( x, y, '>' );
    }

    public setTweets( tweets: Tweet[] )
    {
        const tweet =  0 < this.offset ? this.timeline[ this.offset ] : null;

        this.timeline = tweets;

        if ( !tweet ) { return; }
        const offset = ( () =>
        {
            let offset = 0;
            for ( let t of tweets )
            {
                if ( t.id_str !== tweet.id_str )
                {
                    ++offset;
                    continue;
                }

                return offset;
            }

            return -1;
        } )();

        if ( offset < 0 )
        {
            this.offset = 0;
            this.cursor = 0;
            return;
        }

        this.cursor += offset - this.offset;
        this.offset = offset;
    }

    public render()
    {
        const tweets = this.timeline.slice( this.offset, this.offset + this.height );

        let y = 0;
        tweets.forEach( ( tweet, index ) =>
        {
            if ( this.offset + index === this.cursor )
            {
                this.drawCursor( 0, y );
            }

            this.draw( 1, y++, `${ tweet.user.name }@${ tweet.user.screen_name } ${ tweet.text.replace( /[\x00-\x1F\x7F-\x9F]/g, '' ) }` );
        } );
    }

    public up()
    {
        if ( this.cursor < 1 ) { return false ; }

        --this.cursor;
        if ( this.cursor < this.offset )
        {
            this.offset = this.cursor;
        }

        return true;
    }

    public down()
    {
        if ( this.timeline.length <= this.cursor + 1 ) { return false; }

        ++this.cursor;
        if ( this.offset + this.height - 1 < this.cursor )
        {
            this.offset = this.cursor - this.height + 1;
        }

        return true;
    }
}

class StatusView extends View
{
    private lastUpdate: Date = new Date();
    private errors: string[] = [];

    public setLastUpdate( date: Date ) { this.lastUpdate = date; }

    public render()
    {
        const date = this.lastUpdate.toString();
        const error = StringEx.splitLines( this.errors.shift() || '', this.width - 1 - date.length );
        const status = `${ error } ${ date }`;
        this.draw( this.width - StringEx.width( status ), 1, status );
    }

    public error( message: string )
    {
        this.errors.push( message );
    }
}

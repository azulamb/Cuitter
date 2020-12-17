import { HMAC_SHA1 } from './crypto.ts'
interface FetchParams { [ keys: string ]: string | number | boolean | undefined }

export class OauthFetch
{
    private apiKey: string = '';
    private apiKeySecret: string = '';
    private accessToken: string = '';
    private accessTokenSecret: string = '';

    constructor( apiKey: string, apiKeySecret: string, accessToken: string, accessTokenSecret: string )
    {
        this.apiKey = apiKey;
        this.apiKeySecret = apiKeySecret;
        this.accessToken = accessToken;
        this.accessTokenSecret = accessTokenSecret;
    }

    public request( method: string, url: string, params: FetchParams )
    {
        const authorization = this.createAuthHeader( method, url, params );

        return fetch( 
            this.createUrl( url, params ),
            {
                method: method,
                headers:
                {
                    Authorization: authorization,
                },
            }
        );
    }

    public get( url: string, params: FetchParams )
    {
        return this.request( 'GET', url, params );
    }

    public post( url: string, params: FetchParams )
    {
        return this.request( 'POST', url, params );
    }

    private createAuthHeader( method: string, url: string, params: FetchParams )
    {
        const oauthParams: { [ keys: string ]: string } =
        {
            oauth_consumer_key: this.apiKey,
            oauth_nonce: this.generateNonce(),
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: this.getCurrentTimestamp(),
            oauth_token: this.accessToken,
            oauth_version: '1.0',
        };

        const signatureKey =
        [
            this.encode( this.apiKeySecret ),
            this.encode( this.accessTokenSecret ),
        ].join( '&' );

        const signatureBase = this.generateSignatureBase( method, url, params, oauthParams );

        const signature = HMAC_SHA1.toBase64( signatureKey, signatureBase );

        const headerParams: { [ keys: string ]: string } =
        {
            ... oauthParams,
            oauth_signature: signature,
        };

        return 'OAuth ' + Object.keys( headerParams ).map( ( key ) =>
        {
            return `${ this.encode( key ) }="${ this.encode( headerParams[ key ] ) }"`;
        } ).join( ', ' );
    }

    private generateNonce()
    {
        const array = window.crypto.getRandomValues( new Uint8Array( 32 ) );
        return [ ...array ].map( ( uint ) =>
        {
            return uint.toString( 16 ).padStart( 2, '0' );
        } ).join( '' );
    }

    private getCurrentTimestamp()
    {
        return Math.floor( Date.now() / 1000 ).toString();
    }

    private encode( value: string )
    {
        return encodeURIComponent( value ).replace( /[!'()*]/g, ( char ) => { return '%' + char.charCodeAt( 0 ).toString( 16 ); } );
    }

    private generateSignatureBase( method: string, url: string, params: FetchParams, oauthParams: { [ keys: string ]: string } )
    {
        const allParams: { [ keys: string ]: string } = {};

        Object.keys( oauthParams ).forEach( ( key ) =>
        {
            allParams[ this.encode( key ) ] = this.encode( oauthParams[ key ] );
        } );

        Object.keys( params ).forEach( ( key ) =>
        {
            const value = params[ key ];
            if ( value === undefined ) { return; }
            allParams[ this.encode( key ) ] = this.encode( value + '' );
        } );

        const encodeParams = ( ( params ) =>
        {
            const keys = Object.keys( params );
            keys.sort();

            return keys.map( ( key  ) =>
            {
                return `${ key }=${ params[ key ] }`;
            } );
        } )( allParams );

        return [
            this.encode( method ),
            this.encode( url ),
            this.encode( encodeParams.join( '&' ) ),
        ].join( '&' );
    }

    private createUrl( url: string, params: FetchParams )
    {
        const query = new URLSearchParams();
        Object.keys( params ).forEach( ( key ) =>
        {
            if ( params[ key ] === undefined ) { return; }
            query.append( key, params[ key ] + '' );
        } );
        const queryString = query.toString();

        return queryString ? url + '?' + queryString : url;
    }
}

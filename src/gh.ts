import fetch from 'node-fetch';
import { Octokit } from '@octokit/rest';

type ghServiceOptions = {
  clientId: string;
  clientSecret: string;
  redirectURI: string;
  scope: string[];
  token?: string;
}

type UserInfo = {
  name: string;
  username: string;
  email: string;
  avatar: string;
}

type UserOveralls = {
  name: string,
  repositories: object[],
  sponsorshipRequested: object[],
  sponsorshipReceived: object[]
}


export default class GHService {
  private options: ghServiceOptions;
  private octokit: Octokit | null;

  constructor(options: ghServiceOptions) {
    this.options = options;
    this.octokit = null;
  }

  async auth(code: string) {
    const ghResponse = await (
      await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
          code,
          redirect_uri: this.options.redirectURI,
          scope: this.options.scope.join(' ')
        })
      })).json();

    this.options.token = ghResponse.access_token;
    this.octokit = new Octokit({ auth: this.options.token });

    return this.options.token;
  }

  async getUserInfo(): Promise<UserInfo> {
    const ghResponse = await this.octokit?.users.getAuthenticated();

    if (!ghResponse?.data) {
      throw "Unable to fetch user information form github";
    }

    return {
      avatar: ghResponse.data.avatar_url,
      email: ghResponse.data.email,
      username: ghResponse.data.login,
      name: ghResponse.data.name
    }
  }

  
  /*
  * get repo, sponshirship list, sponsorship received
  * TO-DO: pagination for repos
  * TO-DO: allow user to select fields for repositories
  */
  async getUserOveralls(repoOptions?: Object): Promise<UserOveralls> {
    // const { ...repo } = repoOptions //wip
    console.log('getting user details')
    const ghResponse: any = await this.octokit?.graphql(
      `query { 
        viewer {
          login,
          repositories(first: 30){
            totalCount,
            nodes {
              id,
              name,
              description,
              isPrivate,
              stargazerCount
            }
          }
          sponsorshipsAsMaintainer(first: 10) {
            nodes {
              tier {
                name
                description
                id
                # adminInfo
                sponsorsListing {
                  id
                  name
                  slug
                  shortDescription
                  fullDescription
                }
                descriptionHTML
              }
            }
          }
          sponsorsListing{
            name,
            tiers(first: 25){
                  nodes{
                    name
                    # adminInfo
                    createdAt
                    description
                    descriptionHTML
                    monthlyPriceInDollars
                    sponsorsListing {
                      id
                    }
                    id
                  }
            }
      }
    }
  }`);

  
    if (!ghResponse?.data) {
      throw "Unable to fetch repo and sponsorship information from github";
    }
    const { repositories, sponsorshipListing, sponsorshipsAsMaintainer } = ghResponse.data.viewer;
    return {
     name,
     repositories,
     sponsorshipRequested: sponsorshipListing,
     sponsorshipReceived: sponsorshipsAsMaintainer
    }
  }
}

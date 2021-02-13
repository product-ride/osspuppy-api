import fetch from 'node-fetch';
import { Octokit } from '@octokit/rest';
import { loadConfig } from '../utils/utils';
import { GHSponsorResponse, Sponsor } from '../types';

type GHServiceOptions = {
  clientId: string;
  clientSecret: string;
  redirectURI: string;
  scope: string[];
  token?: string | null;
}

type UserInfo = {
  name: string | null;
  username: string;
  email: string | null;
  avatar: string;
  bio?: string;
}

export default class GHService {
  private options: GHServiceOptions;
  private octokit: Octokit | null;

  constructor(token?: string | null) {
    const {
      GH_CLIENT_ID,
      GH_CLIENT_SECRET,
      GH_REDIRECT_URI,
    } = loadConfig();
    
    this.options = {
      token,
      clientId: GH_CLIENT_ID,
      clientSecret: GH_CLIENT_SECRET,
      redirectURI: GH_REDIRECT_URI,
      scope: ['repo', 'read:user'] //read:name to read a user's profile data.
    };
    this.octokit = this.options.token? new Octokit({ auth: token }): null;
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
          scope: this.options.scope.join(', ')
        })
      })).json();

    this.options.token = ghResponse.access_token;
    this.octokit = new Octokit({ auth: this.options.token });

    return this.options.token;
  }

  async updateToken(token: string) {
    if (!this.octokit) {
      this.options.token = token;

      this.octokit = new Octokit({ auth: this.options.token });
    }
  }

  async getUserInfo(): Promise<UserInfo> {
    const ghResponse = await this.octokit?.users.getAuthenticated();

    if (!ghResponse?.data) {
      throw "Unable to fetch user information form github";
    }

    return {
      avatar: ghResponse.data.avatar_url,
      bio: ghResponse.data.bio,
      email: ghResponse.data.email,
      username: ghResponse.data.login,
      name: ghResponse.data.name
    }
  }

  async addCollaborator(repo: string, owner: string, username: string) {
    return await this.octokit?.repos.addCollaborator({
      owner,
      repo,
      username,
      permission: 'pull'
    });
  }

  async removeCollaborator(repo: string, owner: string, username: string) {
    return await this.octokit?.repos.removeCollaborator({
      owner,
      repo,
      username,
      permission: 'pull'
    });
  }

  async repoExists(owner: string, repo: string) {
    try {
      await this.octokit?.repos.get({ repo, owner: owner });

      return true;
    } catch {
      return false;
    }
  }

  async getSponsors(nextCurosor?: string) {
    const afterFilter = nextCurosor? `, after: "${nextCurosor}"`: '';
    const ghResponse: GHSponsorResponse | undefined = await this.octokit?.graphql(
      `query {
        viewer {
          sponsorshipsAsMaintainer(first: 50, includePrivate: true ${afterFilter}) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              sponsorEntity {
                ...on User {
                  login
                }
              }  
              tier {
                monthlyPriceInDollars
              }
            }
          }
        }
      }`);

    return ghResponse;
  }

  async getAllSponsors() {
    const sponsors: Sponsor[] = [{
      minAmount: 10,
      sponsor: 'jsfactory'
    }];
    let nextCursor;
    do {
      const ghResponse: GHSponsorResponse | undefined = await this.getSponsors(nextCursor);

      if (ghResponse) {
        nextCursor = ghResponse.viewer.sponsorshipsAsMaintainer.pageInfo.endCursor;
      
      for (const sponsor of ghResponse.viewer.sponsorshipsAsMaintainer.nodes) {
        sponsors.push({
          minAmount: sponsor.tier?.monthlyPriceInDollars,
          sponsor: sponsor.sponsorEntity?.login
        });
      }
      }
    } while(nextCursor);
      
    return sponsors;
  }
}

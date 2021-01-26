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

  async addCollaborator(repo: string, owner: string, username: string) {
    return await this.octokit?.repos.addCollaborator({
      owner,
      repo,
      username,
      permission: 'pull'
    });
  }
}

export type SponsorshipJob = {
  ownerId: number;
  sponsor: string;
  amount: number;
}

export type TierUpdateJob = {
  userId: number;
}

export type DeleteRepoJob = {
  ownerOrOrg: string;
  repo: string;
}

export type GHSponsor = {
  sponsorEntity: {
    login: string
  },
  tier: {
    monthlyPriceInDollars: number
  }
}

export type Sponsor = {
  sponsor: string;
  minAmount: number;
}

export type GHSponsorResponse = {
  viewer: {
    sponsorshipsAsMaintainer: {
      totalCount: number,
      pageInfo: {
        hasNextPage: boolean,
        endCursor: string
      }
      nodes: GHSponsor[]
    }
  }
}

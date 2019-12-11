import { mapEachEpochAsync } from '@celo/contractkit/lib/utils/web3-utils'
import { flags } from '@oclif/command'
import BigNumber from 'bignumber.js'
import { cli } from 'cli-ux'
import { BaseCommand } from '../../base'
import { newCheckBuilder } from '../../utils/checks'
import { printValueMapRecursive } from '../../utils/cli'
import { Flags } from '../../utils/command'

export default class Show extends BaseCommand {
  static description =
    'Show rewards information about a voter, registered Validator, or Validator Group'

  static flags = {
    ...BaseCommand.flags,
    address: Flags.address({ required: false, description: 'Address to filter' }),
    epochs: flags.integer({ required: false, description: 'Number of epochs' }),
    'no-truncate': flags.boolean({
      required: false,
      description: "Don't truncate fields to fit line",
    }),
  }

  static args = []

  static examples = ['show --address 0x5409ed021d9299bf6814279a6a1411a7e866a631']

  async run() {
    const res = this.parse(Show)
    const election = await this.kit.contracts.getElection()
    const validators = await this.kit.contracts.getValidators()
    const epochSize = await validators.getEpochSize()

    // Map the votes cast by address at each epoch.
    let addressVotes: { [key: number]: { [key: string]: BigNumber } } = {}
    if (res.flags.address) {
      const address = res.flags.address
      await newCheckBuilder(this)
        .isAccount(address)
        .runChecks()

      addressVotes = await mapEachEpochAsync(
        this.web3,
        async (blockNumber: number) => {
          const voter = await election.getVoter(address, blockNumber)
          const votes: { [key: string]: BigNumber } = {}
          voter.votes.forEach((x) => {
            const group: string = x.group.toLowerCase()
            votes[group] = (votes[group] || new BigNumber(0)).plus(x.active)
          })
          return votes
        },
        epochSize,
        res.flags.epochs
      )
    }

    // voterRewards applies to address when voterReward.group in addressVotes[voterReward.blockNumber].
    const voterRewardsEvents = await election.getVoterRewardEvents(
      epochSize,
      res.flags.epochs,
      res.flags.address ? addressVotes : null
    )

    // validatorRewards applies to address when validatorReward.validator (or .group) is address.
    const validatorRewardsEvents = await validators.getValidatorRewardEvents(
      epochSize,
      res.flags.epochs,
      res.flags.address
    )

    // Get the Validator scores at each epoch.
    const validatorDetails = await mapEachEpochAsync(
      this.web3,
      (blockNumber: number) =>
        validators.getUniqueValidators(
          validatorRewardsEvents,
          (x: any) => x.returnValues.validator.toLowerCase(),
          blockNumber
        ),
      epochSize,
      res.flags.epochs
    )

    // For correctness use the Validator Group name at each epoch?
    const validatorGroupDetails = await validators.getUniqueValidatorGroups(
      voterRewardsEvents,
      (x: any) => x.returnValues.group.toLowerCase()
    )

    if (voterRewardsEvents.length > 0) {
      console.info('')
      console.info('Voter rewards:')
      cli.table(
        voterRewardsEvents,
        {
          name: {
            get: (x: any) => validatorGroupDetails[x.returnValues.group.toLowerCase()].name,
          },
          group: { get: (x: any) => x.returnValues.group },
          value: { get: (x: any) => x.returnValues.value },
          blockNumber: {},
        },
        { 'no-truncate': res.flags['no-truncate'] }
      )
    }

    let validatorRewards = validatorRewardsEvents
    if (res.flags.address) {
      const address = res.flags.address.toLowerCase()
      validatorRewards = validatorRewardsEvents.filter(
        (x: any) => x.returnValues.validator.toLowerCase() === address
      )
    }

    if (validatorRewards.length > 0) {
      console.info('')
      console.info('Validator rewards:')
      cli.table(
        validatorRewards,
        {
          name: {
            get: (x: any) =>
              validatorDetails[x.blockNumber][x.returnValues.validator.toLowerCase()].name,
          },
          validator: { get: (x: any) => x.returnValues.validator },
          validatorPayment: { get: (x: any) => x.returnValues.validatorPayment },
          validatorScore: {
            get: (x: any) =>
              validatorDetails[x.blockNumber][
                x.returnValues.validator.toLowerCase()
              ].score.toFixed(),
          },
          group: { get: (x: any) => x.returnValues.group },
          blockNumber: {},
        },
        { 'no-truncate': res.flags['no-truncate'] }
      )
    }

    let validatorGroupRewards = validatorRewardsEvents
    if (res.flags.address) {
      const address = res.flags.address.toLowerCase()
      validatorGroupRewards = validatorRewardsEvents.filter(
        (x: any) => x.returnValues.group.toLowerCase() === address
      )
    }

    if (validatorGroupRewards.length > 0) {
      console.info('')
      console.info('Validator Group rewards:')
      cli.table(
        validatorGroupRewards,
        {
          name: {
            get: (x: any) => validatorGroupDetails[x.returnValues.group.toLowerCase()].name,
          },
          group: { get: (x: any) => x.returnValues.group },
          groupPayment: { get: (x: any) => x.returnValues.groupPayment },
          validator: { get: (x: any) => x.returnValues.validator },
          validatorScore: {
            get: (x: any) =>
              validatorDetails[x.blockNumber][
                x.returnValues.validator.toLowerCase()
              ].score.toFixed(),
          },
          blockNumber: {},
        },
        { 'no-truncate': res.flags['no-truncate'] }
      )
    }
  }
}

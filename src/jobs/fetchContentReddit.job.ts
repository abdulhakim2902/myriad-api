import {inject} from '@loopback/core'
import {cronJob, CronJob} from '@loopback/cron'
import {repository} from '@loopback/repository'
import {PostRepository, PeopleRepository, TagRepository} from '../repositories'
import {Reddit} from '../services'

@cronJob()

export class FetchContentRedditJob extends CronJob {
  constructor(
    @inject('services.Reddit') protected redditService:Reddit,
    @repository(PostRepository) public postRepository:PostRepository,

    @repository(PeopleRepository) public peopleRepository:PeopleRepository,

    @repository(TagRepository) public tagRepository:TagRepository

  ) {
    super({
      name: 'fetch-content-reddit-job',
      onTick: async () => {
        await this.performJob();
      },
      cronTime: '*/1800 * * * * *',
      start: true
    })
  }

  async performJob() {
    await this.searchPostByTag()
    await this.searchPostByPeople()
  }
  async searchPostByPeople() {
    const people = await this.peopleRepository.find()
    const filterPeople = people.filter((person:any) => {
      return person.username.startsWith('u/')
    })

    for (let i = 0; i < filterPeople.length; i++) {
      const person = filterPeople[i]
      const {data: user} = await this.redditService.getActions(person.username)

      const posts = user.children.filter((post:any) => {
        return post.kind === 't3'
      })

      for (let j = 0; j < posts.length; j++) {
        const post = posts[j].data

        const foundPost = await this.postRepository.findOne({where: {textId: post.id}})

        if (foundPost) continue

        await this.postRepository.create({
          people: {
            username: `u/${post.author}`
          },
          tags: [],
          platform: 'reddit',
          title: post.title,
          text: post.selftext,
          hasMedia: false,
          link: `https://wwww.reddit.com${post.permalink}`,
          createdAt: new Date().toString()
        })
      }
    }
  }
  async searchPostByTag() {
    const tags = await this.tagRepository.find()

    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i]
      const { data } = await this.redditService.getActions(`search.json?q=${tag.id}&sort=new&limit=20`)

      if (data.children.length === 0) continue

      const posts = data.children.filter((post:any) => {
        return post.kind === 't3'
      })

      for (let j = 0; j < posts.length; j++) {
        const post = posts[j].data
        const foundPost = await this.postRepository.findOne({where: {textId: post.id}})

        if (foundPost) continue

        await this.postRepository.create({
          people: {
            username: `u/${post.author}`
          },
          tags: [tag.id],
          platform: 'reddit',
          title: post.title,
          text: post.selftext,
          hasMedia: false,
          link: `https://wwww.reddit.com${post.permalink}`,
          createdAt: new Date().toString()
        })
      }
    }
  }
}
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response,
} from '@loopback/rest';
import {Tag} from '../models';
import {PeopleRepository, PostRepository, TagRepository} from '../repositories';
import {inject} from '@loopback/core'
import {Twitter} from '../services'

export class TagController {
  constructor(
    @repository(TagRepository)
    public tagRepository : TagRepository,
    @repository(PeopleRepository)
    public peopleRepository:PeopleRepository,
    @repository(PostRepository)
    public postRepository:PostRepository,
    @inject('services.Twitter') protected    twitterService:Twitter,
  ) {}

  @post('/tags')
  @response(200, {
    description: 'Tag By Platform model instance',
    content: { 'application/json': { schema: getModelSchemaRef(Tag) } },
  })
  async createTagByPlatform(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Tag, {
            title: 'NewTag',

          }),
        },
      },
    })
    tag: Tag
    ):Promise<any> {
    const searchTwitter = await this.searchTweetsByKeyword(tag.id, 'twitter')
    const searchFacebook = await this.searchFbPostsByKeyword(tag.id, 'facebook')
    const searchReddit = await this.searchRedditPostByKeyword(tag.id, 'reddit')

    if (searchTwitter || searchFacebook || searchReddit) return searchTwitter
    
    return null
  }

  @get('/tags/count')
  @response(200, {
    description: 'Tag model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Tag) where?: Where<Tag>,
  ): Promise<Count> {
    return this.tagRepository.count(where);
  }

  @get('/tags')
  @response(200, {
    description: 'Array of Tag model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Tag, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Tag) filter?: Filter<Tag>,
  ): Promise<Tag[]> {
    return this.tagRepository.find(filter);
  }

  @patch('/tags')
  @response(200, {
    description: 'Tag PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Tag, {partial: true}),
        },
      },
    })
    tag: Tag,
    @param.where(Tag) where?: Where<Tag>,
  ): Promise<Count> {
    return this.tagRepository.updateAll(tag, where);
  }

  @get('/tags/{id}')
  @response(200, {
    description: 'Tag model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Tag, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Tag, {exclude: 'where'}) filter?: FilterExcludingWhere<Tag>
  ): Promise<Tag> {
    return this.tagRepository.findById(id, filter);
  }

  @patch('/tags/{id}')
  @response(204, {
    description: 'Tag PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Tag, {partial: true}),
        },
      },
    })
    tag: Tag,
  ): Promise<void> {
    await this.tagRepository.updateById(id, tag);
  }

  @put('/tags/{id}')
  @response(204, {
    description: 'Tag PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() tag: Tag,
  ): Promise<void> {
    await this.tagRepository.replaceById(id, tag);
  }

  @del('/tags/{id}')
  @response(204, {
    description: 'Tag DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.tagRepository.deleteById(id);
  }

  async searchTweetsByKeyword (keyword:string, platform:string): Promise<any> {
    const word = keyword.replace(/ /g,'')
    const foundTag = await this.tagRepository.findOne({ where: { id: word.toLowerCase() } })

    if (foundTag) return foundTag

    const { data: posts } = await this.twitterService.getActions(`tweets/search/recent?max_results=10&tweet.fields=referenced_tweets,attachments,entities&expansions=author_id&query=%23${word}`)

    if (!posts || posts.errors) return null

    await this.tagRepository.create({
      id: word,
      createdAt: new Date().toString()
    })

    const filterPost = posts.filter((post:any) => !post.referenced_tweets)

    if (filterPost.length > 0) {
      for (let i = 0; i < filterPost.length; i++) {
        const post = filterPost[i]
        const foundPost = await this.postRepository.findOne({where: {textId: post.id, platform }})

        if (!foundPost) {
          const {data: newPeople} = await this.twitterService.getActions(`users/${post.author_id}`)

          const tags = post.entities ? post.entities.hashtags ? post.entities.hashtags.map((hashtag:any) => hashtag.tag.toLowerCase()) : [] : []

          const hasMedia = post.attachments ? Boolean(post.attachments.mediaKeys) : false
          const platform = 'twitter'
          const text = post.text
          const textId = post.id
          const people = {}
          const link = `https://twitter.com/${newPeople.username}/status/${textId}`

          this.postRepository.create({
            textId, text, tags, people, hasMedia, platform, link, createdAt: new Date().toString()
          })
        }
      }
    }

    return {
      id: word,
      hide: false
    }
  }

  async searchFbPostsByKeyword (keyword: string, platform: string): Promise<any> {
    return null
  }

  async searchRedditPostByKeyword (keyword: string, platform: string): Promise<any> {
    return null
  }
}

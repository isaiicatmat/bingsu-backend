import { FastifyPluginAsync } from "fastify"
import { ArticleFilterType, ArticleType, SchemaArticle, SchemaArticleFilter } from "./types"
import { v4 as uuidv4 } from 'uuid';
import { getFileSignedURL, saveFileInBucket } from '../users';
const createError = require('http-errors');
import { ArticleResponse } from './interfaces'
import { FastifyInstance } from "fastify";

const articles: FastifyPluginAsync = async (fastify): Promise<void> => {
    fastify.post<{
        Body: ArticleType
    }>('/', {
        schema: {
            body: SchemaArticle
        }
    },async function(request, reply){
        await fastify.checkRole(request, reply, ['admin', 'maintainer', 'human_resources']);
        const article = request.body;

        try {
            const id = uuidv4();
            await fastify.app().admin.firestore().doc(`articles/${id}`).set({
                name: article.name,
                uid: article.uid,
                serial: article.serial,
                id: id,
                date: new Date(article.date)
            });

            const bucket = fastify.app().admin.storage().bucket();
            if (article.format) await saveFileInBucket(bucket, `articles`, article.format, `${id}`);

            reply.send(article);
        }catch (error: any) {
            reply.send(createError(400, error.message));
        }
    });
    
    fastify.get<{
        Querystring: ArticleFilterType
    }>('/', {
        schema: {
            querystring: SchemaArticleFilter
        }
    }, async function (request, reply) {
        await fastify.checkRole(request, reply, ['admin', 'maintainer', 'human_resources']);

        let {uid} = request.query;
        
        try {
            let articlesQuery = fastify.app().admin.firestore().collection("articles");

            if(uid != null) {
                articlesQuery = articlesQuery.where('uid', '==', uid);
            }

            const articlesQuerySnapshot = await articlesQuery.get();
            let articles: ArticleResponse[] = [];

            articlesQuerySnapshot.forEach((doc: any) => {
                const article = doc.data();
                articles.push(article); 
             });
             reply.send(articles)
        } catch (error : any) {
            reply.send(createError(404, error.message));
        }
    });

    fastify.get<{
        Params: {
          id: string
        }
      }>('/:id', {}, async function (request, reply) {
        await fastify.checkRole(request, reply, [ 'admin', 'maintainer', 'human_resources']);
        try {
          const id = request.params.id;
          const articleQuerySnapshot = await fastify.app().admin.firestore().collection("articles").doc(id).get();
          const bucket = fastify.app().admin.storage().bucket();
          let article: ArticleResponse = articleQuerySnapshot.data();

          article.format = await getFileSignedURL(bucket, `articles/${article.id}`)

          reply.send(article);
        } catch (error: any) {
          reply.send(createError(404, error.message));
        }
      });

      fastify.put<{
        Body: ArticleType,
        Params: {
            id: string
        }
      }>('/:id', {
        schema: {
          body: SchemaArticle,
        }
      }, async function (request, reply) {
            await fastify.checkRole(request, reply, ['admin', 'maintainer', 'human_resources']);
            try {
                let article = request.body;
                await fastify.app().admin.firestore().collection("articles").doc(article.id).update({
                    name: article.name,
                    id: article.id,
                    uid: article.uid,
                    date: new Date(article.date),
                    serial: article.serial
                  });

                if (article.format != ''){
                    const bucket = fastify.app().admin.storage().bucket();
                    await fastify.app().storage.bucket().deleteFiles({
                        prefix: `articles/${article.id}`
                    });
                    await saveFileInBucket(bucket, `articles`, article.format, `${article.id}`);
                }

                reply.send(article);
            } catch (error: any) {
                reply.send(createError(400, error.message));
            }
      });

    fastify.delete<{
        Params: {
            id: String,
        }
    }>('/:id', {}, async function (request, reply) {
        await fastify.checkRole(request, reply, ['admin', 'maintainer', 'human_resources']);
        const id = request.params.id;

        try {
            await fastify.app().admin.firestore().collection("articles").doc(id).delete();
            await fastify.app().storage.bucket().deleteFiles({
                prefix: `articles/${id}`,
            });
            reply.send();
        } catch (error: any) {
            reply.send(createError(500, error.message));
        }
    })
}
export default articles;

export async function deleteUserArticles(fastify: FastifyInstance, uid: string){
    let batch = fastify.app().admin.firestore().batch();
    const articleQuerySnapshot = await fastify.app().admin.firestore().collection("articles")
        .where("uid", "==", uid)
        .get();

        articleQuerySnapshot.forEach( (doc: any) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
}

export async function deleteUserArticleFiles(fastify: FastifyInstance, uid: string){
    const bucket = fastify.app().admin.storage().bucket();
    const articlesQuerySnapshot = await fastify.app().admin.firestore().collection("articles")
        .where("uid", "==", uid)
        .get();

    try {
        articlesQuerySnapshot.forEach( (doc: any) => {
            let path = "articles/" + doc.id;
            bucket.file(path).delete();
        });
    }  catch (error: any) {
        throw new Error("Ha ocurrido al eliminar los archivos asociados al usuario");
    } 
}
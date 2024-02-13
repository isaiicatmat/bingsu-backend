import {Static, Type} from '@sinclair/typebox';

export const SchemaArticle = Type.Object({
    name: Type.String(),
    uid: Type.String(),
    serial: Type.Optional(Type.String()),
    id: Type.Optional(Type.String()),
    date: Type.String(),
    format: Type.String(),
});

export const SchemaArticleFilter = Type.Object({
    uid: Type.Optional(Type.String()),
});

export type ArticleType = Static<typeof SchemaArticle>;
export type ArticleFilterType = Static<typeof SchemaArticleFilter>;
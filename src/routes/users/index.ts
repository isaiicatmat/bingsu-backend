import {FastifyPluginAsync} from "fastify";
import {UserType, SchemaUser} from "./types";
import {User, UserResponse} from "./interfaces";
import {getAuth} from "firebase-admin/auth";
import {deleteUserPermissions, deleteUserPermissionFiles} from '../permissions';
import {deleteUserTransactions, deleteUserInvoices} from '../transactions';
import {deleteUserVacations, getCurrentVacationDays, saveVacation, updateVacationDays} from '../vacations';
import {deleteUserPayments, deleteUserPaymentsFiles, savePayment } from "../payments";
import {Vacation} from "../vacations/interfaces";
import {Payment} from "../payments/interfaces";
import {deleteUserExpenses} from '../expenses';
import {deleteUserCheckIns} from '../check_ins';
import {deleteUserAttendances} from '../attendances'
import { deleteUserArticles, deleteUserArticleFiles } from "../articles";
import { deleteUserPayrollFiles, deleteUserPayrolls } from "../payrolls";

const generator = require('generate-password');
const createError = require('http-errors');

const users: FastifyPluginAsync = async (fastify, opts): Promise<void> => {

  // fastify.post<{
  //   Params: {
  //     id: string
  //   }
  // }>('/:id', async function (request, reply) {
  //   try {
  //     await setAuthRole(request.params.id, 'admin', fastify.app().auth);
  //     reply.send();
  //   } catch (error: any) {
  //     reply.send(createError(500, error.message));
  //   }
  // });

  fastify.post<{
    Body: UserType
  }>('/', {
    schema: {
      body: SchemaUser,
    }
  },async function (request, reply) {
    await fastify.checkRole(request, reply, ['admin', 'maintainer', 'human_resources']);
    try {
      let user = request.body;
      const authUser = await createAuthUser(fastify, user as User);
      await setAuthRole(authUser.uid, user.roles ?? 'user', fastify.app().auth);
      user.id = authUser.uid;
      const bucket = fastify.app().admin.storage().bucket();
      await saveFileInBucket(bucket, authUser.uid, user.ine, 'ine');
      await saveFileInBucket(bucket, authUser.uid, user.bachelorCertificate, 'certificado_estudios');
      await saveFileInBucket(bucket, authUser.uid, user.addressCertificate, 'comprobante_domicilio');
      await saveFileInBucket(bucket, authUser.uid, user.birthCertificate, 'acta_nacimiento');
      await saveFileInBucket(bucket, authUser.uid, user.avatar, 'avatar');

      await fastify.app().admin.firestore().collection("users").doc( authUser.uid).set({
        name: user.name,
        id: user.id,
        firstLastName: user.firstLastName,
        socialSecurityNumber: user.socialSecurityNumber,
        secondLastName: user.secondLastName,
        roles: user.roles,
        phoneNumber: user.phoneNumber,
        address: user.address,
        curp: user.curp,
        rfc: user.rfc,
        email: user.email,
        emergencyNumberOne: user.emergencyNumberOne,
        emergencyNumberTwo: user.emergencyNumberTwo,
        employeeId: user.employeeId,
        hiringDate: new Date(user.hiringDate),
        birthday: new Date(user.birthday),
        bank: user.bank,
        bankAccount: user.bankAccount,
      });

      const vacation: Vacation = {
        days: user.vacationDays,
        date: new Date().toISOString().slice(0, 10),
        availableDays: ""
      }

      await saveVacation(fastify, user.id ?? "", vacation);

      const payment: Payment = {
        amount: user.initialAmount,
        date: new Date().toISOString().slice(0, 10),
      }

      await savePayment(fastify, user.id ?? "", payment);

      reply.send(user);
    } catch (error: any) {
      switch (error.code) {
        case 'auth/email-already-exists':
          reply.send(createError(409, "El correo ya ha sido registrado previamente"));
          break;
        default:
          reply.send(createError(500, error.message));
      }
    }
  });

  fastify.put<{
    Body: UserType
  }>('/:id', {
    schema: {
      body: SchemaUser,
    }
  }, async function (request, reply) {
    await fastify.checkRole(request, reply, ['admin', 'maintainer', 'human_resources']);
    try {
      let user = request.body;

      const savedUserQuerySnapshot = await fastify.app().admin.firestore().collection("users").doc(user.id).get();
      let savedUser: UserResponse = savedUserQuerySnapshot.data();

      if (savedUser.email !== user.email) {
        await updateAuthEmail(user.id ?? "", user.email, fastify.app().auth);
      }

      await fastify.app().admin.firestore().collection("users").doc(user.id).update({
        name: user.name,
        id: user.id,
        firstLastName: user.firstLastName,
        socialSecurityNumber: user.socialSecurityNumber,
        secondLastName: user.secondLastName,
        phoneNumber: user.phoneNumber,
        address: user.address,
        curp: user.curp,
        rfc: user.rfc,
        email: user.email,
        emergencyNumberOne: user.emergencyNumberOne,
        emergencyNumberTwo: user.emergencyNumberTwo,
        employeeId: user.employeeId,
        hiringDate: new Date(user.hiringDate),
        birthday: new Date(user.birthday),
        bank: user.bank,
        bankAccount: user.bankAccount,
      });
      
      const hiringDate = new Date(new Date(+savedUser.hiringDate._seconds * 1000));
      const currentVacation = await getCurrentVacationDays(fastify, user.id ?? "", hiringDate);

      if (currentVacation) {
        await updateVacationDays(fastify, user.vacationDays, currentVacation.id);
      } else {
        const vacation: Vacation = {
          days: user.vacationDays,
          date: new Date().toISOString().slice(0, 10),
          availableDays: ""
        }
        await saveVacation(fastify, user.id ?? "", vacation);
      }

      const bucket = fastify.app().admin.storage().bucket();

      if (user.ine !== '') {
        await saveFileInBucket(bucket, user.id ?? "", user.ine, 'ine');
      }

      if (user.bachelorCertificate !== '') {
        await saveFileInBucket(bucket, user.id ?? "", user.bachelorCertificate, 'certificado_estudios');
      }

      if (user.addressCertificate !== '') {
        await saveFileInBucket(bucket, user.id ?? "", user.addressCertificate, 'comprobante_domicilio');
      }

      if (user.birthCertificate !== '') {
        await saveFileInBucket(bucket, user.id ?? "", user.birthCertificate, 'acta_nacimiento');
      }

      if (user.avatar !== '') {
        await saveFileInBucket(bucket, user.id ?? "", user.avatar, 'avatar');
      }

      reply.send(user);
    } catch (error: any) {
      reply.send(createError(400, error.message));
    }
  });

  fastify.get('/', {}, async function (request, reply) {
    await fastify.checkRole(request, reply, ['user', 'admin', 'maintainer', 'human_resources']);
    try {
      const usersQuerySnapshot = await fastify.app().admin.firestore().collection("users").get();
      let users: any[] = [];
      let authPromises: any[] = [];
      const uid = await fastify.getIdFromToken(request, reply);
      const role = await fastify.getRoleFromToken(request, reply);

      usersQuerySnapshot.forEach((doc: any) => {
        const user = doc.data();
        const userId = user.id;
        authPromises.push(getAuth().getUser(userId));
        users.push(user);
      });

      if (role !== 'maintainer') {
        const authResponses = await Promise.all(authPromises);
        const authMap = new Map();

        authResponses.forEach((authResponse) => {
          if (authResponse.customClaims!.role === 'user' || authResponse.uid == uid) {
            authMap.set(authResponse.uid, authResponse);
          }
        });

        let filteredUsers : any[] = [];
        users.forEach((user) => {
          if (authMap.has(user.id)) {
            user.disabled = authMap.get(user.id).disabled
            filteredUsers.push(user);
          }
        });

        users = filteredUsers;
      }
      
      reply.send(users);
    } catch (error: any) {
      reply.send(createError(404, error.message));
    }
  });

  fastify.get<{
    Params: {
      id: string
    }
  }>('/:id', {}, async function (request, reply) {
    await fastify.checkRole(request, reply, ['user', 'admin', 'maintainer', 'human_resources']);
    try {
      const id = request.params.id;
      const bucket = fastify.app().admin.storage().bucket();
      const userQuerySnapshot = await fastify.app().admin.firestore().collection("users").doc(id).get();
      let user: UserResponse = userQuerySnapshot.data();
      const hiringDate = new Date(new Date(+user.hiringDate._seconds * 1000));
      const currentVacation = await getCurrentVacationDays(fastify, id, hiringDate);
      user.vacationDays = currentVacation ? currentVacation.days : '0';
      user.ine = await getFileSignedURL(bucket, `${user.id}/ine`);
      user.birthCertificate = await getFileSignedURL(bucket, `${user.id}/acta_nacimiento`);
      user.bachelorCertificate = await getFileSignedURL(bucket, `${user.id}/certificado_estudios`);
      user.addressCertificate = await getFileSignedURL(bucket, `${user.id}/comprobante_domicilio`);
      user.avatar = await getFileSignedURL(bucket, `${user.id}/avatar`);
      user.bank = user.bank ? user.bank : '';
      user.bankAccount = user.bankAccount ? user.bankAccount : '';
      reply.send(user);
    } catch (error: any) {
      reply.send(createError(404, error.message));
    }
  });
  
  fastify.delete<{
    Params: {
      id: string
    }
  }>('/:id', {}, async function (request, reply) {
    await fastify.checkRole(request, reply, ['admin', 'maintainer', 'human_resources']);
    try {
      const id = request.params.id;
      const bucket = fastify.app().admin.storage().bucket();
      await deleteAuthUser(fastify, id);
      await fastify.app().admin.firestore().collection("users").doc(id).delete();
      await deleteUserPaymentsFiles(fastify, id);
      await deleteUserPayments(fastify, id);
      await deleteUserFiles(bucket, `${id}/`);
      await deleteUserInvoices(bucket, fastify, id);
      await deleteUserPermissionFiles(fastify, id);
      await deleteUserVacations(fastify, id);
      await deleteUserPermissions(fastify, id);
      await deleteUserTransactions(fastify, id);
      await deleteUserExpenses(fastify, id);
      await deleteUserCheckIns(fastify, id);
      await deleteUserAttendances(fastify, id);
      await deleteUserArticleFiles(fastify, id);
      await deleteUserArticles(fastify, id);
      await deleteUserPayrollFiles(fastify, id);
      await deleteUserPayrolls(fastify, id);
      reply.send();
    } catch (error: any) {
      reply.send(createError(500, error.message));
    }
  });
};


function isPDFOrImageFile(fileContent: string) {
  const mime_type = fileContent?.substring("data:".length, fileContent.indexOf(";base64"));
  if (!(mime_type?.includes('image') || mime_type?.includes('application/pdf'))){
    throw createError(415, "El documento tiene que ser PDF o una imagen");
  } else {
    return mime_type;
  }
}

export async function saveFileInBucket(bucket: any, userId: string, base64EncodeFile: string, fileName: string) {

  const mimeType = isPDFOrImageFile(base64EncodeFile);

  const file = bucket.file(`${userId}/${fileName}`);
  const contents = Buffer.from(base64EncodeFile.replace(/^data:\w+\/\w+;base64,/, ""), 'base64');

  await file.save(contents, {
    public: true,
    resumable: false,
    metadata: {
      contentType: mimeType
    }, validation: false,
  });
}

export async function getFileSignedURL(bucket: any, fileName: string) {
  try {
    const options = {
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes after this link will expire
    };

    const exists = await bucket
      .file(fileName).exists();

    if (exists[0]) {
      const [url] = await bucket
        .file(fileName).getSignedUrl(options);

      return url;
    } else {
      return null;
    }
  } catch (e: any) {
    throw new Error(`Ha ocurrido un error mientras obteníamos el archivo: ${fileName}`);
  }
}

async function deleteUserFiles(bucket: any, fileName: string) {
  try {
    await bucket.deleteFiles({ prefix: fileName});
  } catch (error: any) {
    throw new Error("Ha ocurrido al eliminar los archivos asociados al usuario");
  }
}

async function createAuthUser(fastify: any, user: User) {
  const password = generator.generate({
    length: 12,
    numbers: true,
  });
  return fastify.app().auth.createUser(
      {
        email: user.email,
        password,
      }
  );
}

async function setAuthRole(id: string, role: string, auth: any) {
  try {
    await auth.setCustomUserClaims(id, {role: role});
  } catch (e) {
    throw new Error("Ha ocurrido un error al intentar establecer el rol del usuario");
  }
}

async function updateAuthEmail(id: string, email: string, auth: any) {
  try {
    await auth.updateUser(id, {
      email: email
    });
  } catch (e) {
    throw new Error("Ha ocurrido un error al intentar cambiar el email del usuario");
  }
}

async function deleteAuthUser(fastify: any, id: string) {
  try {
    await fastify.app().auth.deleteUser(id);
  } catch (error: any) {
    throw new Error("Ha ocurrido un error mientras se eliminaba el usuario del auth")
  }
}

export default users;

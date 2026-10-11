/**
 * 运营部老师 seeded into the API database (scrypt hashes only; initial passwords are delivered
 * out of band). Each account must change its password on first sign-in.
 */
export const staffSeed: readonly { name: string; email: string; role: 'superadmin' | 'ops'; passwordHash: string }[] = [
  { name: '张捷嘉', email: 'zhangjiejia@nexus.local', role: 'superadmin', passwordHash: 'scrypt$16384$8$1$KweQRbA4MVd8qluIjaE3vw==$tGhviIhqJ5jSamivSietrKslOctFLaScCVjVYrRiz9E=' },
  { name: '程雪晴', email: 'chengxueqing@nexus.local', role: 'superadmin', passwordHash: 'scrypt$16384$8$1$RqYuyJdvd9m27ahUF7rKXw==$NSk4YwdZ3X+BjpDmiEuVSLZo3JxHrTpGSsjiilUU1Os=' },
  { name: '张雪航', email: 'zhangxuehang@nexus.local', role: 'superadmin', passwordHash: 'scrypt$16384$8$1$v0kd17hV1robsx6sA1WNWw==$L7a5O6i8RIhRB+sqNLLQlOYM7utoAwHlTTrzoULtRes=' },
  { name: '许瑾', email: 'xujin@nexus.local', role: 'ops', passwordHash: 'scrypt$16384$8$1$ZVo4OzZ55kPppr4284f3+A==$OvL2qI/rBuDjPKNmf8Bq8ZjI7tS2bQrMddpbv7RkE9Y=' },
  { name: '方彦淇', email: 'fangyanqi@nexus.local', role: 'ops', passwordHash: 'scrypt$16384$8$1$skGxC7go2dWfX1X+cZwcKA==$7aSqiWGzuKKeg8mLGD5PiMqad4zJX9yLUml3SFQTeBI=' },
];

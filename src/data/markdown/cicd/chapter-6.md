## 构建产物证明与供应链安全

过去 CI/CD 关注“能不能自动构建和部署”。现在更重要的问题是：

- 这个包真的是从这份源码构建出来的吗？
- 构建过程有没有被篡改？
- 发布到生产的镜像能不能追溯到某次 workflow？
- 依赖和产物有没有 SBOM 或证明材料？

构建产物证明（Artifact Attestation）就是给产物附上一份可验证的“出生证明”：它说明产物由哪个仓库、哪个工作流、哪次提交、哪个身份构建。

### 核心概念

| 概念 | 说明 |
| --- | --- |
| Provenance | 产物来源证明，描述构建来源、构建环境和触发信息 |
| Attestation | 对产物及其元数据的签名声明 |
| SBOM | Software Bill of Materials，软件物料清单 |
| OIDC | CI 平台向签名/云服务证明身份的机制 |
| SLSA | 供应链安全成熟度框架 |

### GitHub Actions 最小示例

```yaml
name: build-and-attest

on:
  push:
    branches: [main]

permissions:
  contents: read
  id-token: write
  attestations: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build artifact
        run: |
          mkdir -p dist
          echo "hello yunzhan" > dist/app.txt

      - name: Generate artifact attestation
        uses: actions/attest-build-provenance@v2
        with:
          subject-path: dist/app.txt
```

关键点：

- `id-token: write` 允许 workflow 通过 OIDC 获取身份令牌。
- `attestations: write` 允许写入证明。
- `subject-path` 指向你要证明的产物。

### 验证产物

下载产物后，可以使用 GitHub CLI 验证：

```bash
gh attestation verify dist/app.txt \
  --owner your-org
```

验证的意义不是“文件能不能打开”，而是确认：

- 产物和证明里的摘要一致。
- 证明来自预期的仓库或组织。
- 证明由可信的 GitHub Actions 构建身份签发。

### 容器镜像证明

对镜像做证明时，推荐使用不可变 digest：

```yaml
- name: Build and push image
  id: push
  uses: docker/build-push-action@v6
  with:
    context: .
    push: true
    tags: ghcr.io/acme/yunzhan:${{ github.sha }}

- name: Attest image
  uses: actions/attest-build-provenance@v2
  with:
    subject-name: ghcr.io/acme/yunzhan
    subject-digest: ${{ steps.push.outputs.digest }}
    push-to-registry: true
```

镜像部署时应优先使用 digest，而不是只使用可变 tag：

```bash
kubectl set image deploy/yunzhan \
  app=ghcr.io/acme/yunzhan@sha256:xxxx
```

### 和 SBOM 的关系

Provenance 回答：

> 这个产物是谁、在哪里、用什么流程构建出来的？

SBOM 回答：

> 这个产物里面包含哪些依赖、库、基础镜像和组件？

二者是互补关系。生产发布建议至少保留：

- 镜像 digest。
- 构建 provenance。
- SBOM 文件。
- 漏洞扫描报告。
- 部署审批记录。

### 运维落地清单

| 阶段 | 要求 |
| --- | --- |
| 构建 | workflow 权限最小化，禁止长期密钥写死在仓库 |
| 产物 | 使用不可变 digest，保存 attestation |
| 扫描 | 对镜像和依赖做漏洞扫描 |
| 发布 | 只允许有证明的产物进入生产 |
| 审计 | 保留 commit、workflow run、审批人、部署时间 |

### 常见误区

| 误区 | 正确理解 |
| --- | --- |
| 有 CI 日志就够了 | 日志不能代替可验证证明 |
| tag 能代表唯一版本 | tag 可变，digest 才不可变 |
| Attestation 等于安全无漏洞 | 它证明来源，不证明没有漏洞 |
| 只给最终 zip 做证明即可 | 镜像、二进制、SBOM 都应该纳入链路 |

### 实战任务

1. 在 GitHub Actions 中构建一个 zip 或镜像。
2. 为产物生成 provenance attestation。
3. 下载产物并用 `gh attestation verify` 验证。
4. 把镜像部署清单从 tag 改成 digest。
5. 在发布记录中写入 commit、workflow run、digest 和验证结果。

完成后，你的发布流程就从“我相信这个包没问题”，升级成“我能证明这个包来自哪里”。
